import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GenieAcsService } from '../genieacs/genieacs.service';
import { DeviceNormalizer } from '../devices/tr069/device-normalizer';
import { AutoConfig, AutoConfigDocument } from './schemas/autoconfig.schema';
import { LogsService } from '../logs/logs.service';
import { LogCategory } from '../logs/schemas/log.schema';

@Injectable()
export class AutoConfigService {
  private readonly logger = new Logger(AutoConfigService.name);

  constructor(
    private genieAcsService: GenieAcsService,
    @InjectModel(AutoConfig.name) private autoConfigModel: Model<AutoConfigDocument>,
    private logsService: LogsService,
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

  async applyToDevice(deviceId: string): Promise<{ applied: string[]; errors: string[] }> {
    const device = await this.genieAcsService.getDevice(deviceId);
    if (!device) throw new NotFoundException(`Dispositivo ${deviceId} não encontrado`);

    const normalized = DeviceNormalizer.normalize(device);
    const configs = await this.autoConfigModel.find({ enabled: true }).sort({ priority: -1 }).exec();
    const applied: string[] = [];
    const errors: string[] = [];

    for (const config of configs) {
      if (!this.matchesConditions(normalized, config.conditions)) continue;

      try {
        if (config.parameters?.length > 0) {
          const values: [string, any, string][] = config.parameters.map((p) => [p.name, p.value, p.type]);
          await this.genieAcsService.setParameterValues(deviceId, values);
        }

        for (const tag of config.tagsToAdd || []) {
          await this.genieAcsService.addTag(deviceId, tag);
        }

        await this.autoConfigModel.findByIdAndUpdate(config._id, {
          $inc: { 'stats.applied': 1 },
          $set: { 'stats.lastApplied': new Date() },
        });

        applied.push(config.name);
        await this.logsService.info(`AutoConfig "${config.name}" aplicado em ${deviceId}`, LogCategory.AUTOCONFIG, { deviceId, rule: config.name }, deviceId).catch(() => {});
      } catch (err: any) {
        this.logger.error(`Erro ao aplicar AutoConfig ${config.name} em ${deviceId}: ${err?.message}`);
        await this.autoConfigModel.findByIdAndUpdate(config._id, { $inc: { 'stats.errors': 1 } });
        await this.logsService.warn(`AutoConfig "${config.name}" falhou em ${deviceId}: ${err?.message}`, LogCategory.AUTOCONFIG, { deviceId, rule: config.name, error: err?.message }, deviceId).catch(() => {});
        errors.push(`${config.name}: ${err?.message || String(err)}`);
      }
    }

    return { applied, errors };
  }

  /** Simula quais regras seriam aplicadas a um dispositivo (sem executar) */
  async dryRun(deviceId: string): Promise<{
    deviceId: string;
    manufacturer: string;
    model: string;
    oui: string;
    matches: { rule: string; id: string; parameters: number; tags: string[] }[];
    total: number;
  }> {
    const device = await this.genieAcsService.getDevice(deviceId);
    if (!device) throw new NotFoundException(`Dispositivo ${deviceId} não encontrado`);
    const normalized = DeviceNormalizer.normalize(device);
    const configs = await this.autoConfigModel.find({ enabled: true }).sort({ priority: -1 }).exec();
    const matches = configs
      .filter(c => this.matchesConditions(normalized, c.conditions))
      .map(c => ({
        rule: c.name,
        id: String(c._id),
        parameters: c.parameters?.length || 0,
        tags: c.tagsToAdd || [],
      }));
    return {
      deviceId,
      manufacturer: normalized.manufacturer || '',
      model: normalized.model || '',
      oui: normalized.oui || '',
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
            const values: [string, any, string][] = config.parameters.map(p => [p.name, p.value, p.type]);
            await this.genieAcsService.setParameterValues(device._id, values);
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
          // Remove tags de firmware antigas (fw:*) antes de adicionar a nova
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

    const configs = await this.autoConfigModel.find({ enabled: true }).exec();
    if (!configs.length) return;

    const devices = await this.genieAcsService.getDevices({}, ['_id', '_lastInform', 'DeviceID']);
    let applied = 0;

    for (const device of devices) {
      const normalized = DeviceNormalizer.normalize(device);
      for (const config of configs) {
        if (this.matchesConditions(normalized, config.conditions)) {
          try {
            if (config.parameters?.length > 0) {
              const values: [string, any, string][] = config.parameters.map((p) => [p.name, p.value, p.type]);
              await this.genieAcsService.setParameterValues(device._id, values);
              applied++;
            }
          } catch {
            // silencioso no cron
          }
        }
      }
    }

    this.logger.log(`AutoConfig periódico concluído: ${applied} aplicações`);
    if (applied > 0) {
      await this.logsService.info(`AutoConfig periódico: ${applied} aplicações em ${devices.length} dispositivos`, LogCategory.AUTOCONFIG, { applied, total: devices.length }).catch(() => {});
    }
  }

  private matchesConditions(device: any, conditions: AutoConfig['conditions']): boolean {
    if (!conditions) return true;
    if (conditions.manufacturer && !device.manufacturer?.toLowerCase().includes(conditions.manufacturer.toLowerCase())) return false;
    if (conditions.model && !device.model?.toLowerCase().includes(conditions.model.toLowerCase())) return false;
    if (conditions.oui && device.oui !== conditions.oui) return false;
    if (conditions.serialPattern) {
      const re = new RegExp(conditions.serialPattern, 'i');
      if (!re.test(device.serialNumber)) return false;
    }
    if (conditions.tags?.length) {
      const hasAll = conditions.tags.every((t) => device.tags?.includes(t));
      if (!hasAll) return false;
    }
    return true;
  }
}
