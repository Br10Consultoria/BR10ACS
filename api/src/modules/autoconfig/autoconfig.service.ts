import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GenieAcsService } from '../genieacs/genieacs.service';
import { DeviceNormalizer } from '../devices/tr069/device-normalizer';
import { AutoConfig, AutoConfigDocument } from './schemas/autoconfig.schema';
import { LogsService } from '../logs/logs.service';
import { LogCategory } from '../logs/schemas/log.schema';
import { IxcService } from '../integrations/ixc.service';
import { IntegrationsService } from '../integrations/integrations.service';

/**
 * Contexto de resolução de variáveis para um dispositivo.
 * Contém os dados do GenieACS e do IXC já buscados.
 */
interface VariableContext {
  /** Parâmetros brutos do GenieACS (ex: { 'InternetGatewayDevice.WANDevice...': { _value: 'login' } }) */
  genieParams: Record<string, any>;
  /** Login PPPoE encontrado no GenieACS ou IXC */
  pppoeLogin?: string;
  /** Senha PPPoE encontrada no IXC */
  pppoePassword?: string;
  /** SSID WiFi 2.4GHz encontrado no GenieACS */
  wifiSsid?: string;
  /** Senha WiFi encontrada no GenieACS */
  wifiPassword?: string;
  /** SSID WiFi 5GHz encontrado no GenieACS */
  wifiSsid5g?: string;
  /** Dados brutos do IXC (radusuarios + radpop_radio_cliente_fibra) */
  ixcData?: Record<string, any>;
}

@Injectable()
export class AutoConfigService {
  private readonly logger = new Logger(AutoConfigService.name);

  constructor(
    private genieAcsService: GenieAcsService,
    @InjectModel(AutoConfig.name) private autoConfigModel: Model<AutoConfigDocument>,
    private logsService: LogsService,
    private ixcService: IxcService,
    private integrationsService: IntegrationsService,
  ) {}

  async findAll(): Promise<AutoConfigDocument[]> {
    return this.autoConfigModel.find().sort({ priority: -1 }).exec();
  }

  async findById(id: string): Promise<AutoConfigDocument> {
    const doc = await this.autoConfigModel.findById(id).exec();
    if (!doc) throw new NotFoundException('AutoConfig não encontrado');
    return doc;
  }

  async create(data: Partial<AutoConfig>): Promise<AutoConfigDocument> {
    return this.autoConfigModel.create(data);
  }

  async update(id: string, data: Partial<AutoConfig>): Promise<AutoConfigDocument> {
    const doc = await this.autoConfigModel.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after' }).exec();
    if (!doc) throw new NotFoundException('AutoConfig não encontrado');
    return doc;
  }

  async remove(id: string): Promise<void> {
    await this.autoConfigModel.findByIdAndDelete(id).exec();
  }

  /**
   * Aplica todas as regras de AutoConfig elegíveis a um dispositivo específico.
   * Suporta variáveis dinâmicas ${...} nos valores dos parâmetros.
   * @param deviceId ID do dispositivo no GenieACS
   * @param tr069Event Evento TR-069 que disparou a execução (ex: 'BOOTSTRAP', 'BOOT', 'PERIODIC')
   */
  async applyToDevice(
    deviceId: string,
    tr069Event?: string,
  ): Promise<{ applied: string[]; errors: string[] }> {
    const device = await this.genieAcsService.getDevice(deviceId);
    if (!device) throw new NotFoundException(`Dispositivo ${deviceId} não encontrado`);

    const normalized = DeviceNormalizer.normalize(device);
    const configs = await this.autoConfigModel.find({ enabled: true }).sort({ priority: -1 }).exec();
    const applied: string[] = [];
    const errors: string[] = [];

    for (const config of configs) {
      if (!this.matchesConditions(normalized, config.conditions, tr069Event)) continue;

      try {
        if (config.parameters?.length > 0) {
          // Resolve variáveis antes de enviar
          const resolvedParams = await this.resolveParameterValues(
            deviceId,
            device,
            normalized,
            config,
          );
          if (resolvedParams.length > 0) {
            await this.genieAcsService.setParameterValues(deviceId, resolvedParams);
          }
        }

        for (const tag of config.tagsToAdd || []) {
          await this.genieAcsService.addTag(deviceId, tag);
        }

        await this.autoConfigModel.findByIdAndUpdate(config._id, {
          $inc: { 'stats.applied': 1 },
          $set: { 'stats.lastApplied': new Date() },
        });

        applied.push(config.name);
        await this.logsService.info(
          `AutoConfig "${config.name}" aplicado em ${deviceId}${tr069Event ? ` (evento: ${tr069Event})` : ''}`,
          LogCategory.AUTOCONFIG,
          { deviceId, rule: config.name, tr069Event },
          deviceId,
        ).catch(() => {});
      } catch (err: any) {
        this.logger.error(`Erro ao aplicar AutoConfig ${config.name} em ${deviceId}: ${err?.message}`);
        await this.autoConfigModel.findByIdAndUpdate(config._id, { $inc: { 'stats.errors': 1 } });
        await this.logsService.warn(
          `AutoConfig "${config.name}" falhou em ${deviceId}: ${err?.message}`,
          LogCategory.AUTOCONFIG,
          { deviceId, rule: config.name, error: err?.message },
          deviceId,
        ).catch(() => {});
        errors.push(`${config.name}: ${err?.message || String(err)}`);
      }
    }

    return { applied, errors };
  }

  /**
   * Resolve os valores dos parâmetros de uma regra, substituindo variáveis dinâmicas.
   *
   * Variáveis suportadas:
   *   ${device.serialNumber}         — Serial number da ONT
   *   ${device.manufacturer}         — Fabricante
   *   ${device.model}                — Modelo
   *   ${device.softwareVersion}      — Versão do firmware
   *   ${param.CAMINHO_TR069}         — Valor de qualquer parâmetro TR-069 já lido pelo GenieACS
   *                                    Ex: ${param.InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username}
   *   ${ixc.pppoe_login}             — Login PPPoE buscado no IXC pelo MAC/Serial da ONT
   *   ${ixc.pppoe_password}          — Senha PPPoE buscada no IXC
   *   ${ixc.wifi_ssid}               — SSID WiFi 2.4GHz (lido do GenieACS, fallback IXC)
   *   ${ixc.wifi_password}           — Senha WiFi (lida do GenieACS)
   *   ${ixc.wifi_ssid_5g}            — SSID WiFi 5GHz (lido do GenieACS)
   *   ${ixc.vlan_pppoe}              — VLAN PPPoE cadastrada no IXC
   */
  private async resolveParameterValues(
    deviceId: string,
    rawDevice: any,
    normalized: any,
    config: AutoConfigDocument,
  ): Promise<[string, any, string][]> {
    const params = config.parameters || [];

    // Verifica se algum parâmetro usa variáveis
    const hasVariables = params.some(p => typeof p.value === 'string' && p.value.includes('${'));
    if (!hasVariables) {
      // Sem variáveis: retorna direto
      return params.map(p => [p.name, p.value, p.type] as [string, any, string]);
    }

    // Monta o contexto de variáveis (lazy: só busca IXC se necessário)
    const ctx = await this.buildVariableContext(deviceId, rawDevice, normalized, config);

    return params.map(p => {
      const resolved = typeof p.value === 'string'
        ? this.interpolate(p.value, ctx, normalized)
        : p.value;
      return [p.name, resolved, p.type] as [string, any, string];
    });
  }

  /**
   * Constrói o contexto de variáveis para um dispositivo.
   * Busca dados do GenieACS (parâmetros TR-069) e do IXC (login/senha PPPoE).
   */
  private async buildVariableContext(
    deviceId: string,
    rawDevice: any,
    normalized: any,
    config: AutoConfigDocument,
  ): Promise<VariableContext> {
    const ctx: VariableContext = { genieParams: rawDevice };

    // ── Extrai PPPoE login do GenieACS ────────────────────────────────────────
    const pppoeLoginPaths = [
      'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username',
      'Device.PPP.Interface.1.Username',
    ];
    for (const path of pppoeLoginPaths) {
      const val = this.extractGenieParam(rawDevice, path);
      if (val) { ctx.pppoeLogin = val; break; }
    }

    // ── Extrai SSID WiFi 2.4GHz do GenieACS ──────────────────────────────────
    const ssidPaths = [
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID',
      'Device.WiFi.SSID.1.SSID',
    ];
    for (const path of ssidPaths) {
      const val = this.extractGenieParam(rawDevice, path);
      if (val) { ctx.wifiSsid = val; break; }
    }

    // ── Extrai SSID WiFi 5GHz do GenieACS ────────────────────────────────────
    const ssid5gPaths = [
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID',
      'Device.WiFi.SSID.2.SSID',
    ];
    for (const path of ssid5gPaths) {
      const val = this.extractGenieParam(rawDevice, path);
      if (val) { ctx.wifiSsid5g = val; break; }
    }

    // ── Extrai senha WiFi do GenieACS ─────────────────────────────────────────
    const wifiPassPaths = [
      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey',
      'Device.WiFi.AccessPoint.1.Security.KeyPassphrase',
    ];
    for (const path of wifiPassPaths) {
      const val = this.extractGenieParam(rawDevice, path);
      if (val) { ctx.wifiPassword = val; break; }
    }

    // ── Busca dados no IXC (apenas se algum parâmetro usa ${ixc.*}) ───────────
    const needsIxc = (config.parameters || []).some(
      p => typeof p.value === 'string' && p.value.includes('${ixc.'),
    );

    if (needsIxc) {
      try {
        const integrationId = await this.resolveIxcIntegrationId(config.ixcIntegrationId);
        if (integrationId) {
          // Busca pelo MAC da ONT (campo connectionRequestUrl ou onu_mac)
          const mac = normalized.serialNumber || '';
          const ixcResult = await this.ixcService.lookupOntComplete(integrationId, { mac });

          if (ixcResult.found) {
            ctx.ixcData = {
              ...(ixcResult.radUsuario || {}),
              ...(ixcResult.ontFibra || {}),
            };

            // Login PPPoE do IXC (sobrescreve o do GenieACS se disponível)
            if (ixcResult.radUsuario?.login) {
              ctx.pppoeLogin = ixcResult.radUsuario.login;
            }

            // VLAN PPPoE do IXC
            if (ixcResult.ontFibra?.vlan_pppoe) {
              ctx.ixcData['vlan_pppoe'] = ixcResult.ontFibra.vlan_pppoe;
            }

            // Senha PPPoE: busca separadamente pelo login
            if (ctx.pppoeLogin) {
              const passResult = await this.ixcService.getRadUserPassword(integrationId, ctx.pppoeLogin);
              if (passResult.found && passResult.password) {
                ctx.pppoePassword = passResult.password;
              }
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Erro ao buscar dados IXC para ${deviceId}: ${err?.message}`);
      }
    }

    return ctx;
  }

  /**
   * Substitui variáveis ${...} em uma string pelo valor do contexto.
   */
  private interpolate(template: string, ctx: VariableContext, normalized: any): string {
    return template.replace(/\$\{([^}]+)\}/g, (match, key) => {
      const k = key.trim();

      // Variáveis de dispositivo
      if (k === 'device.serialNumber') return normalized.serialNumber || match;
      if (k === 'device.manufacturer') return normalized.manufacturer || match;
      if (k === 'device.model') return normalized.model || match;
      if (k === 'device.softwareVersion') return normalized.softwareVersion || match;
      if (k === 'device.oui') return normalized.oui || match;

      // Variáveis IXC
      if (k === 'ixc.pppoe_login') return ctx.pppoeLogin || match;
      if (k === 'ixc.pppoe_password') return ctx.pppoePassword || match;
      if (k === 'ixc.wifi_ssid') return ctx.wifiSsid || match;
      if (k === 'ixc.wifi_password') return ctx.wifiPassword || match;
      if (k === 'ixc.wifi_ssid_5g') return ctx.wifiSsid5g || match;
      if (k.startsWith('ixc.') && ctx.ixcData) {
        const field = k.slice(4); // remove 'ixc.'
        return ctx.ixcData[field] ?? match;
      }

      // Variáveis de parâmetro TR-069 direto do GenieACS
      if (k.startsWith('param.')) {
        const paramPath = k.slice(6); // remove 'param.'
        const val = this.extractGenieParam(ctx.genieParams, paramPath);
        return val ?? match;
      }

      return match;
    });
  }

  /**
   * Extrai o valor de um parâmetro TR-069 do objeto bruto do GenieACS.
   * O GenieACS armazena os valores como { _value: '...', _type: '...' }.
   */
  private extractGenieParam(device: any, path: string): string | undefined {
    if (!device) return undefined;
    const parts = path.split('.');
    let current = device;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    if (current && typeof current === 'object' && '_value' in current) {
      return String(current._value ?? '');
    }
    return typeof current === 'string' ? current : undefined;
  }

  /**
   * Resolve o ID da integração IXC a usar.
   * Se não informado na regra, usa a primeira integração IXC ativa.
   */
  private async resolveIxcIntegrationId(configuredId?: string): Promise<string | null> {
    if (configuredId) return configuredId;
    try {
      const integrations = await this.integrationsService.findAll();
      const ixc = integrations.find(
        (i: any) => i.type === 'ixc' && i.enabled,
      );
      return ixc ? String((ixc as any)._id) : null;
    } catch {
      return null;
    }
  }

  /** Simula quais regras seriam aplicadas a um dispositivo (sem executar) */
  async dryRun(deviceId: string, tr069Event?: string): Promise<{
    deviceId: string;
    manufacturer: string;
    model: string;
    oui: string;
    tr069Event?: string;
    matches: { rule: string; id: string; parameters: number; tags: string[]; hasVariables: boolean }[];
    total: number;
  }> {
    const device = await this.genieAcsService.getDevice(deviceId);
    if (!device) throw new NotFoundException(`Dispositivo ${deviceId} não encontrado`);
    const normalized = DeviceNormalizer.normalize(device);
    const configs = await this.autoConfigModel.find({ enabled: true }).sort({ priority: -1 }).exec();
    const matches = configs
      .filter(c => this.matchesConditions(normalized, c.conditions, tr069Event))
      .map(c => ({
        rule: c.name,
        id: String(c._id),
        parameters: c.parameters?.length || 0,
        tags: c.tagsToAdd || [],
        hasVariables: (c.parameters || []).some(p => typeof p.value === 'string' && p.value.includes('${')),
      }));
    return {
      deviceId,
      manufacturer: normalized.manufacturer || '',
      model: normalized.model || '',
      oui: normalized.oui || '',
      tr069Event,
      matches,
      total: matches.length,
    };
  }

  /** Força execução imediata em todos os dispositivos */
  async applyAll(): Promise<{ devices: number; applications: number; errors: number }> {
    const configs = await this.autoConfigModel.find({ enabled: true }).sort({ priority: -1 }).exec();
    if (!configs.length) return { devices: 0, applications: 0, errors: 0 };

    const devices = await this.genieAcsService.getDevices({}, ['_id', '_lastInform', 'DeviceID']);
    let applications = 0;
    let errors = 0;

    for (const device of devices) {
      const normalized = DeviceNormalizer.normalize(device);
      for (const config of configs) {
        if (!this.matchesConditions(normalized, config.conditions)) continue;
        try {
          if (config.parameters?.length > 0) {
            const resolvedParams = await this.resolveParameterValues(device._id, device, normalized, config);
            if (resolvedParams.length > 0) {
              await this.genieAcsService.setParameterValues(device._id, resolvedParams);
            }
          }
          for (const tag of config.tagsToAdd || []) {
            await this.genieAcsService.addTag(device._id, tag);
          }
          await this.autoConfigModel.findByIdAndUpdate(config._id, {
            $inc: { 'stats.applied': 1 },
            $set: { 'stats.lastApplied': new Date() },
          });
          applications++;
        } catch {
          errors++;
        }
      }
    }

    return { devices: devices.length, applications, errors };
  }

  /**
   * Aplica tags automáticas em todos os dispositivos baseado em fabricante, modelo e firmware.
   * Tags geradas: fabricante (ex: "intelbras"), modelo (ex: "1200R"), firmware (ex: "fw:2.2-250203").
   * Chamado pelo cron horário e também exposto via endpoint manual.
   */
  async applyAutoTags(): Promise<{ devices: number; tagged: number; errors: number }> {
    const devices = await this.genieAcsService.getDevices({}, [
      '_id', '_tags', 'DeviceID',
      'InternetGatewayDevice.DeviceInfo.Manufacturer',
      'InternetGatewayDevice.DeviceInfo.ModelName',
      'InternetGatewayDevice.DeviceInfo.SoftwareVersion',
      'Device.DeviceInfo.Manufacturer',
      'Device.DeviceInfo.ModelName',
      'Device.DeviceInfo.SoftwareVersion',
    ]);

    let tagged = 0;
    let errors = 0;

    for (const device of devices) {
      try {
        const normalized = DeviceNormalizer.normalize(device);
        if (!normalized?.id) continue;

        const existingTags: string[] = device._tags || [];
        const tagsToAdd: string[] = [];

        // Tag de fabricante (normalizado, sem espaços)
        if (normalized.manufacturer) {
          const vendorTag = normalized.manufacturer.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
          if (vendorTag && !existingTags.includes(vendorTag)) tagsToAdd.push(vendorTag);
        }

        // Tag de modelo
        if (normalized.model) {
          const modelTag = normalized.model.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
          if (modelTag && !existingTags.includes(modelTag)) tagsToAdd.push(modelTag);
        }

        // Tag de firmware (prefixada com "fw:" para não colidir com outras tags)
        if (normalized.softwareVersion) {
          const fwTag = `fw:${normalized.softwareVersion.replace(/\s+/g, '_')}`;
          const oldFwTags = existingTags.filter(t => t.startsWith('fw:') && t !== fwTag);
          for (const old of oldFwTags) {
            await this.genieAcsService.removeTag(device._id, old).catch(() => {});
          }
          if (!existingTags.includes(fwTag)) tagsToAdd.push(fwTag);
        }

        for (const tag of tagsToAdd) {
          await this.genieAcsService.addTag(device._id, tag);
        }

        if (tagsToAdd.length > 0) tagged++;
      } catch (err: any) {
        errors++;
        this.logger.warn(`Erro ao aplicar auto-tags em ${device._id}: ${err?.message}`);
      }
    }

    this.logger.log(`Auto-tags: ${tagged} dispositivos tagueados, ${errors} erros`);
    return { devices: devices.length, tagged, errors };
  }

  /** Estatísticas globais de autoconfig */
  async getStats(): Promise<{
    totalRules: number;
    activeRules: number;
    totalApplied: number;
    totalErrors: number;
    lastApplied?: Date;
  }> {
    const all = await this.autoConfigModel.find().exec();
    const totalApplied = all.reduce((s, c) => s + (c.stats?.applied || 0), 0);
    const totalErrors = all.reduce((s, c) => s + (c.stats?.errors || 0), 0);
    const dates = all.map(c => c.stats?.lastApplied).filter(Boolean) as Date[];
    const lastApplied = dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    return {
      totalRules: all.length,
      activeRules: all.filter(c => c.enabled).length,
      totalApplied,
      totalErrors,
      lastApplied,
    };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runAutoConfigCron(): Promise<void> {
    this.logger.log('Executando AutoConfig periódico...');

    // Aplica tags automáticas (fabricante, modelo, firmware) em todos os dispositivos
    this.applyAutoTags().catch(err => this.logger.warn(`Erro no applyAutoTags: ${err?.message}`));

    // Executa regras com evento PERIODIC ou ANY
    const configs = await this.autoConfigModel.find({ enabled: true }).exec();
    if (!configs.length) return;

    const periodicConfigs = configs.filter(c =>
      !c.conditions?.tr069Event ||
      c.conditions.tr069Event === 'ANY' ||
      c.conditions.tr069Event === 'PERIODIC',
    );
    if (!periodicConfigs.length) return;

    const devices = await this.genieAcsService.getDevices({}, ['_id', '_lastInform', 'DeviceID']);
    let applied = 0;

    for (const device of devices) {
      const normalized = DeviceNormalizer.normalize(device);
      for (const config of periodicConfigs) {
        if (this.matchesConditions(normalized, config.conditions, 'PERIODIC')) {
          try {
            if (config.parameters?.length > 0) {
              const resolvedParams = await this.resolveParameterValues(device._id, device, normalized, config);
              if (resolvedParams.length > 0) {
                await this.genieAcsService.setParameterValues(device._id, resolvedParams);
                applied++;
              }
            }
          } catch {
            // silencioso no cron
          }
        }
      }
    }

    this.logger.log(`AutoConfig periódico concluído: ${applied} aplicações`);
    if (applied > 0) {
      await this.logsService.info(
        `AutoConfig periódico: ${applied} aplicações em ${devices.length} dispositivos`,
        LogCategory.AUTOCONFIG,
        { applied, total: devices.length },
      ).catch(() => {});
    }
  }

  /**
   * Verifica se um dispositivo atende às condições de uma regra de AutoConfig.
   * @param device Dispositivo normalizado
   * @param conditions Condições da regra
   * @param tr069Event Evento TR-069 atual (se houver)
   */
  private matchesConditions(
    device: any,
    conditions: AutoConfig['conditions'],
    tr069Event?: string,
  ): boolean {
    if (!conditions) return true;

    if (conditions.manufacturer && !device.manufacturer?.toLowerCase().includes(conditions.manufacturer.toLowerCase())) return false;
    if (conditions.model && !device.model?.toLowerCase().includes(conditions.model.toLowerCase())) return false;
    if (conditions.oui && device.oui !== conditions.oui) return false;
    if (conditions.firmwareVersion && !device.softwareVersion?.toLowerCase().includes(conditions.firmwareVersion.toLowerCase())) return false;

    if (conditions.serialPattern) {
      const re = new RegExp(conditions.serialPattern, 'i');
      if (!re.test(device.serialNumber)) return false;
    }

    if (conditions.tags?.length) {
      const hasAll = conditions.tags.every((t) => device.tags?.includes(t));
      if (!hasAll) return false;
    }

    // Filtro por evento TR-069
    if (conditions.tr069Event && conditions.tr069Event !== 'ANY') {
      if (!tr069Event) return false; // regra exige evento mas nenhum foi informado
      if (conditions.tr069Event !== tr069Event) return false;
    }

    return true;
  }
}
