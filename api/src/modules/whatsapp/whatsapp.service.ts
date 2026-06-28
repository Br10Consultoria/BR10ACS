/**
 * WhatsAppService — Atendente digital via WhatsApp Business Cloud API (Meta).
 *
 * Funcionalidades de autoatendimento:
 *   1. Troca de senha WiFi (2.4 GHz e 5 GHz)
 *   2. Troca de senha PPPoE
 *   3. Consulta de status da conexão (sinal óptico, uptime, IP)
 *   4. Reboot remoto da ONT
 *   5. Consulta de dados do contrato (plano, vencimento, status financeiro)
 *   6. Abertura de chamado no ERP
 *
 * Fluxo de identificação:
 *   - Cliente envia qualquer mensagem → bot solicita login PPPoE ou CPF
 *   - Bot consulta IXC → localiza ONT no GenieACS pelo MAC/IP
 *   - Após identificação, menu de opções com botões interativos
 *
 * API utilizada: WhatsApp Business Cloud API (Graph API v20.0)
 * Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { SettingsService } from '../settings/settings.service';
import { LogsService } from '../logs/logs.service';
import { LogCategory, LogLevel } from '../logs/schemas/log.schema';
import { GenieAcsService } from '../genieacs/genieacs.service';
import { IxcService } from '../integrations/ixc.service';
import { Integration, IntegrationDocument } from '../integrations/schemas/integration.schema';
import {
  WhatsAppSession,
  WhatsAppSessionDocument,
  WaState,
} from './schemas/whatsapp-session.schema';

// ── Tipos internos ─────────────────────────────────────────────────────────────
interface WifiNetwork {
  index: number;
  ssid: string;
  paramPath: string;
  ssidPath: string;
}

interface WaConfig {
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
  enabled: boolean;
  welcomeMessage: string;
  businessName: string;
}

// ── Constantes ─────────────────────────────────────────────────────────────────
const GRAPH_API_VERSION = 'v20.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const MAX_LOGIN_ATTEMPTS = 3;

// Caminhos TR-069 para WiFi (TR-098 e TR-181)
const WIFI_PATHS = {
  TR098: {
    ssid: (i: number) => `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${i}.SSID`,
    pass: (i: number) => `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${i}.PreSharedKey.1.PreSharedKey`,
    enable: (i: number) => `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${i}.Enable`,
  },
  TR181: {
    ssid: (i: number) => `Device.WiFi.SSID.${i}.SSID`,
    pass: (i: number) => `Device.WiFi.AccessPoint.${i}.Security.KeyPassphrase`,
    enable: (i: number) => `Device.WiFi.SSID.${i}.Enable`,
  },
};

// Caminhos TR-069 para PPPoE
const PPPOE_PATHS = {
  TR098: {
    user: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username',
    pass: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password',
  },
  TR181: {
    user: 'Device.PPP.Interface.1.Username',
    pass: 'Device.PPP.Interface.1.Password',
  },
};

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    @InjectModel(WhatsAppSession.name)
    private sessionModel: Model<WhatsAppSessionDocument>,
    @InjectModel(Integration.name)
    private integrationModel: Model<IntegrationDocument>,
    private readonly settingsService: SettingsService,
    private readonly logsService: LogsService,
    private readonly genieAcsService: GenieAcsService,
    private readonly ixcService: IxcService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════════
  // WEBHOOK — Ponto de entrada
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Verifica o webhook do WhatsApp (GET — handshake inicial com a Meta).
   * A Meta envia hub.mode=subscribe, hub.verify_token e hub.challenge.
   */
  async verifyWebhook(
    mode: string,
    token: string,
    challenge: string,
  ): Promise<string | null> {
    const config = await this.getConfig();
    if (mode === 'subscribe' && token === config.verifyToken) {
      this.logger.log('Webhook do WhatsApp verificado com sucesso.');
      return challenge;
    }
    this.logger.warn(`Falha na verificação do webhook. Token recebido: ${token}`);
    return null;
  }

  /**
   * Processa um payload de webhook recebido da Meta (POST).
   */
  async handleWebhook(payload: any): Promise<void> {
    try {
      const entries = payload?.entry || [];
      for (const entry of entries) {
        const changes = entry?.changes || [];
        for (const change of changes) {
          if (change.field !== 'messages') continue;
          const value = change.value;
          const messages = value?.messages || [];
          const contacts = value?.contacts || [];

          for (const msg of messages) {
            const phone: string = msg.from;
            const displayName: string = contacts[0]?.profile?.name || '';
            await this.processIncomingMessage(phone, displayName, msg);
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Erro ao processar webhook WhatsApp: ${err.message}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // PROCESSAMENTO DE MENSAGENS
  // ══════════════════════════════════════════════════════════════════════════════

  private async processIncomingMessage(
    phone: string,
    displayName: string,
    msg: any,
  ): Promise<void> {
    // Extrai texto da mensagem (texto simples ou resposta de botão interativo)
    let text = '';
    if (msg.type === 'text') {
      text = msg.text?.body?.trim() || '';
    } else if (msg.type === 'interactive') {
      const iType = msg.interactive?.type;
      if (iType === 'button_reply') {
        text = msg.interactive.button_reply?.id || '';
      } else if (iType === 'list_reply') {
        text = msg.interactive.list_reply?.id || '';
      }
    }

    if (!text) return;

    this.logger.debug(`[WA] ${phone} (${displayName}): "${text}"`);

    const session = await this.getOrCreateSession(phone, displayName);
    const lower = text.toLowerCase();

    // Comandos globais
    if (['cancelar', 'cancel', 'sair', 'exit', '/cancelar'].includes(lower)) {
      await this.resetSession(phone);
      await this.sendText(phone, '❌ Atendimento cancelado. Digite *oi* para recomeçar.');
      return;
    }

    if (['oi', 'olá', 'ola', 'menu', '/start', 'inicio', 'início', 'ajuda', 'help'].includes(lower)) {
      await this.resetSession(phone);
      await this.sendMainMenu(phone, displayName);
      return;
    }

    // Roteamento por estado
    switch (session.state as WaState) {
      case 'idle':
      case 'waiting_menu_choice':
        await this.handleMenuChoice(phone, text, session);
        break;
      case 'waiting_login':
        await this.handleLoginInput(phone, text, session);
        break;
      case 'waiting_ssid_choice':
        await this.handleSsidChoice(phone, text, session);
        break;
      case 'waiting_new_wifi_pass':
        await this.handleNewWifiPassword(phone, text, session);
        break;
      case 'waiting_new_pppoe_pass':
        await this.handleNewPppoePassword(phone, text, session);
        break;
      case 'waiting_reboot_confirm':
        await this.handleRebootConfirm(phone, text, session);
        break;
      default:
        await this.sendMainMenu(phone, displayName);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // HANDLERS DE ESTADO
  // ══════════════════════════════════════════════════════════════════════════════

  private async handleMenuChoice(
    phone: string,
    choice: string,
    session: WhatsAppSessionDocument,
  ): Promise<void> {
    switch (choice) {
      case 'menu_wifi':
      case '1':
        if (session.deviceId) {
          await this.startWifiFlow(phone, session);
        } else {
          await this.updateSession(phone, { state: 'waiting_login', _pendingAction: 'wifi' } as any);
          await this.sendText(phone,
            '🔐 Para alterar a senha WiFi, preciso identificar você.\n\n' +
            'Por favor, informe seu *login PPPoE* (ex: cliente@provedor) ou seu *CPF* (somente números).',
          );
        }
        break;

      case 'menu_pppoe':
      case '2':
        if (session.deviceId) {
          await this.updateSession(phone, { state: 'waiting_new_pppoe_pass' });
          await this.sendText(phone,
            '🔑 Informe a *nova senha PPPoE* desejada.\n\n' +
            '_Mínimo 8 caracteres, sem espaços._',
          );
        } else {
          await this.updateSession(phone, { state: 'waiting_login', _pendingAction: 'pppoe' } as any);
          await this.sendText(phone,
            '🔐 Para alterar a senha PPPoE, preciso identificar você.\n\n' +
            'Por favor, informe seu *login PPPoE* ou *CPF*.',
          );
        }
        break;

      case 'menu_status':
      case '3':
        if (session.deviceId) {
          await this.sendConnectionStatus(phone, session.deviceId);
        } else {
          await this.updateSession(phone, { state: 'waiting_login', _pendingAction: 'status' } as any);
          await this.sendText(phone,
            '🔐 Para consultar o status da sua conexão, preciso identificar você.\n\n' +
            'Por favor, informe seu *login PPPoE* ou *CPF*.',
          );
        }
        break;

      case 'menu_reboot':
      case '4':
        if (session.deviceId) {
          await this.updateSession(phone, { state: 'waiting_reboot_confirm' });
          await this.sendRebootConfirmation(phone);
        } else {
          await this.updateSession(phone, { state: 'waiting_login', _pendingAction: 'reboot' } as any);
          await this.sendText(phone,
            '🔐 Para reiniciar o roteador, preciso identificar você.\n\n' +
            'Por favor, informe seu *login PPPoE* ou *CPF*.',
          );
        }
        break;

      case 'menu_contract':
      case '5':
        if (session.ixcClientId) {
          await this.sendContractInfo(phone, session);
        } else {
          await this.updateSession(phone, { state: 'waiting_login', _pendingAction: 'contract' } as any);
          await this.sendText(phone,
            '🔐 Para consultar seu contrato, preciso identificar você.\n\n' +
            'Por favor, informe seu *login PPPoE* ou *CPF*.',
          );
        }
        break;

      case 'menu_ticket':
      case '6':
        await this.updateSession(phone, { state: 'waiting_login', _pendingAction: 'ticket' } as any);
        await this.sendText(phone,
          '🎫 Para abrir um chamado de suporte, preciso identificar você.\n\n' +
          'Por favor, informe seu *login PPPoE* ou *CPF*.',
        );
        break;

      default:
        await this.sendMainMenu(phone, session.displayName || '');
    }
  }

  private async handleLoginInput(
    phone: string,
    input: string,
    session: WhatsAppSessionDocument,
  ): Promise<void> {
    const attempts = (session.loginAttempts || 0) + 1;

    if (attempts > MAX_LOGIN_ATTEMPTS) {
      await this.resetSession(phone);
      await this.sendText(phone,
        '⚠️ Número máximo de tentativas atingido. Por favor, entre em contato com o suporte.\n\n' +
        'Digite *oi* para recomeçar.',
      );
      return;
    }

    await this.sendText(phone, '⏳ Aguarde, estou buscando seus dados...');

    try {
      // Busca integração IXC ativa
      const integration = await this.integrationModel.findOne({
        type: 'ixc',
        enabled: true,
      }).exec();

      if (!integration) {
        await this.sendText(phone,
          '⚠️ Serviço temporariamente indisponível. Tente novamente mais tarde.',
        );
        return;
      }

      // Consulta o IXC pelo login PPPoE ou CPF
      const ixcResult = await this.ixcService.lookupRadUser(
        integration._id.toString(),
        { login: input.trim() },
      );

      if (!ixcResult || !ixcResult.found || !ixcResult.data) {
        await this.updateSession(phone, { loginAttempts: attempts });
        const remaining = MAX_LOGIN_ATTEMPTS - attempts;
        await this.sendText(phone,
          `❌ Não encontrei nenhum cliente com esse login/CPF.\n\n` +
          (remaining > 0
            ? `Tente novamente (${remaining} tentativa${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}).`
            : ''),
        );
        return;
      }

      const radUser = ixcResult.data!;
      const loginPppoe = radUser.login || input.trim();

      // Localiza o dispositivo no GenieACS
      let deviceId: string | null = null;
      let deviceSerial: string | null = null;

      try {
        const devices = await this.genieAcsService.getDevices(
          { 'summary.pppoe': loginPppoe },
          ['_id', 'DeviceID.SerialNumber'],
        );
        if (devices && devices.length > 0) {
          deviceId = (devices[0] as any)._id || null;
          deviceSerial = (devices[0] as any).DeviceID?.SerialNumber?._value || null;
        }
      } catch (e: any) {
        this.logger.warn(`Não foi possível localizar dispositivo para ${loginPppoe}: ${e.message}`);
      }

      // Atualiza sessão com dados do cliente
      const pendingAction = (session as any)._pendingAction || 'menu';
      await this.updateSession(phone, {
        state: 'waiting_menu_choice',
        login: loginPppoe,
        deviceId,
        deviceSerial,
        ixcClientId: radUser.id_cliente?.toString() || null,
        loginAttempts: 0,
      });

      const nome = (radUser as any).nome || session.displayName || 'Cliente';
      await this.sendText(phone,
        `✅ Olá, *${nome}*! Identificação confirmada.\n\n` +
        (deviceId
          ? `📡 Dispositivo encontrado: *${deviceSerial || deviceId}*`
          : '⚠️ Nenhum dispositivo encontrado para este login.'),
      );

      // Redireciona para a ação pendente
      const updatedSession = await this.getOrCreateSession(phone, session.displayName || '');
      await this.handleMenuChoice(phone, `menu_${pendingAction}`, updatedSession);

    } catch (err: any) {
      this.logger.error(`Erro ao buscar cliente: ${err.message}`);
      await this.updateSession(phone, { loginAttempts: attempts });
      await this.sendText(phone,
        '⚠️ Ocorreu um erro ao buscar seus dados. Tente novamente.',
      );
    }
  }

  private async handleSsidChoice(
    phone: string,
    choice: string,
    session: WhatsAppSessionDocument,
  ): Promise<void> {
    const networks: WifiNetwork[] = session.wifiNetworksJson
      ? JSON.parse(session.wifiNetworksJson)
      : [];

    // Aceita "1", "2", "3" ou IDs como "net_0", "net_1"
    let idx = -1;
    if (/^net_\d+$/.test(choice)) {
      idx = parseInt(choice.replace('net_', ''), 10);
    } else if (/^\d+$/.test(choice)) {
      idx = parseInt(choice, 10) - 1;
    }

    if (idx < 0 || idx >= networks.length) {
      await this.sendText(phone, '❌ Opção inválida. Por favor, escolha uma das redes listadas.');
      return;
    }

    await this.updateSession(phone, {
      state: 'waiting_new_wifi_pass',
      selectedNetworkIndex: idx,
    });

    const net = networks[idx];
    await this.sendText(phone,
      `📶 Rede selecionada: *${net.ssid || `Rede ${idx + 1}`}*\n\n` +
      'Informe a *nova senha WiFi*:\n' +
      '_• Mínimo 8 caracteres_\n' +
      '_• Máximo 63 caracteres_\n' +
      '_• Sem espaços_',
    );
  }

  private async handleNewWifiPassword(
    phone: string,
    password: string,
    session: WhatsAppSessionDocument,
  ): Promise<void> {
    // Validação
    if (password.length < 8 || password.length > 63 || /\s/.test(password)) {
      await this.sendText(phone,
        '❌ Senha inválida.\n\n' +
        '• Mínimo 8 caracteres\n' +
        '• Máximo 63 caracteres\n' +
        '• Sem espaços\n\n' +
        'Tente novamente:',
      );
      return;
    }

    const { deviceId, wifiNetworksJson, selectedNetworkIndex } = session;
    if (!deviceId || wifiNetworksJson === null || selectedNetworkIndex === null) {
      await this.sendText(phone, '⚠️ Sessão expirada. Digite *oi* para recomeçar.');
      await this.resetSession(phone);
      return;
    }

    const networks: WifiNetwork[] = JSON.parse(wifiNetworksJson);
    const network = networks[selectedNetworkIndex];

    await this.sendText(phone, '⏳ Aplicando a nova senha WiFi...');

    try {
      await this.genieAcsService.setParameterValues(deviceId, [
        [network.paramPath, password, 'xsd:string'],
      ]);

      await this.logsService.info(
        `Senha WiFi alterada via WhatsApp (rede: ${network.ssid}, cliente: ${session.login})`,
        LogCategory.SYSTEM,
        { phone, login: session.login, ssid: network.ssid },
        deviceId,
      );

      await this.resetSession(phone);
      await this.sendText(phone,
        `✅ *Senha WiFi alterada com sucesso!*\n\n` +
        `📶 Rede: *${network.ssid}*\n` +
        `🔑 Nova senha aplicada.\n\n` +
        `_Aguarde alguns segundos para o roteador aplicar a configuração._\n\n` +
        `Digite *oi* para voltar ao menu.`,
      );
    } catch (err: any) {
      this.logger.error(`Erro ao alterar senha WiFi: ${err.message}`);
      await this.sendText(phone,
        '❌ Não foi possível alterar a senha WiFi. Verifique se o roteador está online e tente novamente.\n\n' +
        'Digite *oi* para voltar ao menu.',
      );
      await this.resetSession(phone);
    }
  }

  private async handleNewPppoePassword(
    phone: string,
    password: string,
    session: WhatsAppSessionDocument,
  ): Promise<void> {
    if (password.length < 6 || /\s/.test(password)) {
      await this.sendText(phone,
        '❌ Senha inválida. Mínimo 6 caracteres, sem espaços. Tente novamente:',
      );
      return;
    }

    const { deviceId } = session;
    if (!deviceId) {
      await this.sendText(phone, '⚠️ Dispositivo não encontrado. Digite *oi* para recomeçar.');
      await this.resetSession(phone);
      return;
    }

    await this.sendText(phone, '⏳ Alterando a senha PPPoE...');

    try {
      // Tenta TR-098 primeiro, depois TR-181
      let applied = false;
      for (const paths of [PPPOE_PATHS.TR098, PPPOE_PATHS.TR181]) {
        try {
          await this.genieAcsService.setParameterValues(deviceId, [
            [paths.pass, password, 'xsd:string'],
          ]);
          applied = true;
          break;
        } catch {
          // tenta o próximo
        }
      }

      if (!applied) throw new Error('Nenhum path TR-069 funcionou');

      await this.logsService.info(
        `Senha PPPoE alterada via WhatsApp (cliente: ${session.login})`,
        LogCategory.SYSTEM,
        { phone, login: session.login },
        deviceId,
      );

      await this.resetSession(phone);
      await this.sendText(phone,
        '✅ *Senha PPPoE alterada com sucesso!*\n\n' +
        '_O roteador irá reconectar automaticamente._\n\n' +
        'Digite *oi* para voltar ao menu.',
      );
    } catch (err: any) {
      this.logger.error(`Erro ao alterar senha PPPoE: ${err.message}`);
      await this.sendText(phone,
        '❌ Não foi possível alterar a senha PPPoE. Tente novamente mais tarde.\n\n' +
        'Digite *oi* para voltar ao menu.',
      );
      await this.resetSession(phone);
    }
  }

  private async handleRebootConfirm(
    phone: string,
    choice: string,
    session: WhatsAppSessionDocument,
  ): Promise<void> {
    if (['sim', 'yes', 'confirmar', 'reboot_yes'].includes(choice.toLowerCase())) {
      const { deviceId } = session;
      if (!deviceId) {
        await this.sendText(phone, '⚠️ Dispositivo não encontrado. Digite *oi* para recomeçar.');
        await this.resetSession(phone);
        return;
      }

      await this.sendText(phone, '⏳ Enviando comando de reinicialização...');

      try {
        await this.genieAcsService.reboot(deviceId);

        await this.logsService.info(
          `Reboot solicitado via WhatsApp (cliente: ${session.login})`,
          LogCategory.SYSTEM,
          { phone, login: session.login },
          deviceId,
        );

        await this.resetSession(phone);
        await this.sendText(phone,
          '✅ *Comando de reinicialização enviado!*\n\n' +
          '_O roteador irá reiniciar em alguns segundos. A conexão pode ficar indisponível por até 2 minutos._\n\n' +
          'Digite *oi* para voltar ao menu.',
        );
      } catch (err: any) {
        this.logger.error(`Erro ao reiniciar dispositivo: ${err.message}`);
        await this.sendText(phone,
          '❌ Não foi possível reiniciar o roteador. Verifique se ele está online.\n\n' +
          'Digite *oi* para voltar ao menu.',
        );
        await this.resetSession(phone);
      }
    } else {
      await this.resetSession(phone);
      await this.sendText(phone, '❌ Reinicialização cancelada. Digite *oi* para voltar ao menu.');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // FLUXOS AUXILIARES
  // ══════════════════════════════════════════════════════════════════════════════

  private async startWifiFlow(
    phone: string,
    session: WhatsAppSessionDocument,
  ): Promise<void> {
    const { deviceId } = session;
    if (!deviceId) {
      await this.sendText(phone, '⚠️ Dispositivo não encontrado. Digite *oi* para recomeçar.');
      await this.resetSession(phone);
      return;
    }

    await this.sendText(phone, '⏳ Buscando redes WiFi do seu roteador...');

    const networks = await this.getWifiNetworks(deviceId);

    if (!networks || networks.length === 0) {
      await this.sendText(phone,
        '⚠️ Não foi possível ler as redes WiFi do seu roteador.\n\n' +
        'Verifique se ele está online e tente novamente.',
      );
      await this.resetSession(phone);
      return;
    }

    await this.updateSession(phone, {
      wifiNetworksJson: JSON.stringify(networks),
    });

    if (networks.length === 1) {
      // Apenas uma rede — vai direto para a senha
      await this.updateSession(phone, {
        state: 'waiting_new_wifi_pass',
        selectedNetworkIndex: 0,
      });
      await this.sendText(phone,
        `📶 Rede WiFi: *${networks[0].ssid || 'Sem nome'}*\n\n` +
        'Informe a *nova senha WiFi*:\n' +
        '_• Mínimo 8 caracteres_\n' +
        '_• Máximo 63 caracteres_\n' +
        '_• Sem espaços_',
      );
    } else {
      // Múltiplas redes — exibe botões interativos
      await this.updateSession(phone, { state: 'waiting_ssid_choice' });
      await this.sendNetworkSelection(phone, networks);
    }
  }

  private async sendConnectionStatus(phone: string, deviceId: string): Promise<void> {
    await this.sendText(phone, '⏳ Consultando status da sua conexão...');

    try {
      const device = await this.genieAcsService.getDevice(deviceId);
      if (!device) {
        await this.sendText(phone, '⚠️ Não foi possível obter o status do dispositivo.');
        return;
      }

      const getVal = (obj: any) => obj?._value ?? obj?.value ?? null;

      // Extrai dados relevantes
      const uptime = getVal(
        device['InternetGatewayDevice.DeviceInfo.UpTime'] ||
        device['Device.DeviceInfo.UpTime'],
      );
      const rxPower = getVal(
        device['InternetGatewayDevice.WANDevice.1.X_CT-COM_GponInterfaceConfig.RXPower'] ||
        device['Device.Optical.Interface.1.CurrentOpticalReceivePower'],
      );
      const wanIp = getVal(
        device['InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress'] ||
        device['Device.IP.Interface.1.IPv4Address.1.IPAddress'],
      );
      const pppoeUser = getVal(
        device['InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username'] ||
        device['Device.PPP.Interface.1.Username'],
      );

      const uptimeStr = uptime
        ? `${Math.floor(Number(uptime) / 3600)}h ${Math.floor((Number(uptime) % 3600) / 60)}m`
        : 'N/A';

      const rxStr = rxPower ? `${(Number(rxPower) / 1000).toFixed(2)} dBm` : 'N/A';

      let statusMsg = '📡 *Status da sua conexão:*\n\n';
      statusMsg += `🟢 Status: *Online*\n`;
      if (pppoeUser) statusMsg += `👤 Login: *${pppoeUser}*\n`;
      if (wanIp) statusMsg += `🌐 IP WAN: *${wanIp}*\n`;
      if (uptime) statusMsg += `⏱ Uptime: *${uptimeStr}*\n`;
      if (rxPower) statusMsg += `📶 Sinal óptico: *${rxStr}*\n`;

      statusMsg += '\nDigite *oi* para voltar ao menu.';

      await this.sendText(phone, statusMsg);
    } catch (err: any) {
      this.logger.error(`Erro ao obter status: ${err.message}`);
      await this.sendText(phone, '⚠️ Não foi possível obter o status. Tente novamente.');
    }
  }

  private async sendContractInfo(
    phone: string,
    session: WhatsAppSessionDocument,
  ): Promise<void> {
    await this.sendText(phone, '⏳ Consultando dados do seu contrato...');

    try {
      const integration = await this.integrationModel.findOne({
        type: 'ixc',
        enabled: true,
      }).exec();

      if (!integration || !session.login) {
        await this.sendText(phone, '⚠️ Não foi possível obter os dados do contrato.');
        return;
      }

      const result = await this.ixcService.lookupOntComplete(
        integration._id.toString(),
        { login: session.login },
      );

      if (!result.found || !result.radUsuario) {
        await this.sendText(phone, '⚠️ Cliente não encontrado no sistema.');
        return;
      }

      const rad = result.radUsuario as any;
      const ontFibra = result.ontFibra as any;
      let msg = '📋 *Dados do seu contrato:*\n\n';
      if (rad?.nome) msg += `👤 Nome: *${rad.nome}*\n`;
      if (rad?.login) msg += `🔑 Login: *${rad.login}*\n`;
      if (rad?.ativo !== undefined) msg += `📊 Status: *${rad.ativo === 'S' || rad.ativo === '1' ? '✅ Ativo' : '❌ Inativo'}*\n`;
      if (ontFibra?.plano) msg += `📦 Plano: *${ontFibra.plano}*\n`;
      if (ontFibra?.vencimento) msg += `📅 Vencimento: *Dia ${ontFibra.vencimento}*\n`;

      msg += '\nDigite *oi* para voltar ao menu.';
      await this.sendText(phone, msg);
    } catch (err: any) {
      this.logger.error(`Erro ao obter contrato: ${err.message}`);
      await this.sendText(phone, '⚠️ Não foi possível obter os dados do contrato.');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ENVIO DE MENSAGENS — WhatsApp Cloud API
  // ══════════════════════════════════════════════════════════════════════════════

  private async sendMainMenu(phone: string, name: string): Promise<void> {
    const config = await this.getConfig();
    const greeting = name ? `Olá, *${name}*! ` : '';

    await this.updateSession(phone, { state: 'waiting_menu_choice' });

    // Envia mensagem com botões interativos (máx 3 por mensagem na API Meta)
    // Dividimos em duas mensagens para cobrir todas as opções
    await this.sendInteractiveButtons(phone, {
      body: `${greeting}Bem-vindo ao atendimento digital da *${config.businessName || 'sua operadora'}*! 🌐\n\nComo posso ajudar você hoje?`,
      footer: 'Selecione uma opção abaixo',
      buttons: [
        { id: 'menu_wifi', title: '📶 Trocar senha WiFi' },
        { id: 'menu_pppoe', title: '🔑 Trocar senha PPPoE' },
        { id: 'menu_status', title: '📡 Ver status conexão' },
      ],
    });

    // Segunda mensagem com mais opções
    await this.sendInteractiveButtons(phone, {
      body: 'Mais opções:',
      buttons: [
        { id: 'menu_reboot', title: '🔄 Reiniciar roteador' },
        { id: 'menu_contract', title: '📋 Dados do contrato' },
        { id: 'menu_ticket', title: '🎫 Abrir chamado' },
      ],
    });
  }

  private async sendRebootConfirmation(phone: string): Promise<void> {
    await this.sendInteractiveButtons(phone, {
      body: '⚠️ *Confirmar reinicialização?*\n\nO roteador ficará offline por até 2 minutos durante o processo.',
      buttons: [
        { id: 'reboot_yes', title: '✅ Sim, reiniciar' },
        { id: 'cancelar', title: '❌ Cancelar' },
      ],
    });
  }

  private async sendNetworkSelection(phone: string, networks: WifiNetwork[]): Promise<void> {
    // Máximo 3 botões por mensagem
    const buttons = networks.slice(0, 3).map((net, i) => ({
      id: `net_${i}`,
      title: net.ssid ? net.ssid.substring(0, 20) : `Rede ${i + 1}`,
    }));

    await this.sendInteractiveButtons(phone, {
      body: `📶 Foram encontradas *${networks.length} redes WiFi*. Qual deseja alterar a senha?`,
      footer: 'Selecione a rede',
      buttons,
    });
  }

  /**
   * Envia mensagem de texto simples via WhatsApp Cloud API.
   */
  async sendText(phone: string, text: string): Promise<void> {
    const config = await this.getConfig();
    if (!config.enabled || !config.phoneNumberId || !config.accessToken) {
      this.logger.warn('WhatsApp não configurado. Mensagem não enviada.');
      return;
    }

    try {
      await axios.post(
        `${GRAPH_API_BASE}/${config.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: 'text',
          text: { body: text, preview_url: false },
        },
        {
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );
    } catch (err: any) {
      this.logger.error(
        `Erro ao enviar mensagem WhatsApp para ${phone}: ${err.response?.data?.error?.message || err.message}`,
      );
    }
  }

  /**
   * Envia mensagem com botões interativos (máx 3 botões).
   */
  async sendInteractiveButtons(
    phone: string,
    opts: {
      body: string;
      footer?: string;
      buttons: Array<{ id: string; title: string }>;
    },
  ): Promise<void> {
    const config = await this.getConfig();
    if (!config.enabled || !config.phoneNumberId || !config.accessToken) return;

    const buttons = opts.buttons.slice(0, 3).map(b => ({
      type: 'reply',
      reply: { id: b.id, title: b.title.substring(0, 20) },
    }));

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: opts.body },
        action: { buttons },
      },
    };

    if (opts.footer) {
      payload.interactive.footer = { text: opts.footer.substring(0, 60) };
    }

    try {
      await axios.post(
        `${GRAPH_API_BASE}/${config.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );
    } catch (err: any) {
      this.logger.error(
        `Erro ao enviar botões WhatsApp para ${phone}: ${err.response?.data?.error?.message || err.message}`,
      );
      // Fallback: tenta enviar como texto simples
      await this.sendText(phone, opts.body);
    }
  }

  /**
   * Envia notificação proativa para um número (usado para alertas de rede).
   */
  async sendNotification(phone: string, message: string): Promise<void> {
    await this.sendText(phone, message);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // CONFIGURAÇÃO E WEBHOOK
  // ══════════════════════════════════════════════════════════════════════════════

  async getConfig(): Promise<WaConfig> {
    const [enabled, phoneNumberId, accessToken, verifyToken, welcomeMessage, businessName] =
      await Promise.all([
        this.settingsService.get<boolean>('whatsapp.enabled', false),
        this.settingsService.get<string>('whatsapp.phoneNumberId', ''),
        this.settingsService.get<string>('whatsapp.accessToken', ''),
        this.settingsService.get<string>('whatsapp.verifyToken', ''),
        this.settingsService.get<string>('whatsapp.welcomeMessage', ''),
        this.settingsService.get<string>('whatsapp.businessName', ''),
      ]);

    return { enabled, phoneNumberId, accessToken, verifyToken, welcomeMessage, businessName };
  }

  async saveConfig(config: Partial<WaConfig>): Promise<void> {
    const pairs: { key: string; value: any }[] = [];
    if (config.enabled !== undefined) pairs.push({ key: 'whatsapp.enabled', value: config.enabled });
    if (config.phoneNumberId !== undefined) pairs.push({ key: 'whatsapp.phoneNumberId', value: config.phoneNumberId });
    if (config.accessToken !== undefined) pairs.push({ key: 'whatsapp.accessToken', value: config.accessToken });
    if (config.verifyToken !== undefined) pairs.push({ key: 'whatsapp.verifyToken', value: config.verifyToken });
    if (config.welcomeMessage !== undefined) pairs.push({ key: 'whatsapp.welcomeMessage', value: config.welcomeMessage });
    if (config.businessName !== undefined) pairs.push({ key: 'whatsapp.businessName', value: config.businessName });
    await this.settingsService.setBulk(pairs);
  }

  async getWebhookInfo(): Promise<any> {
    const config = await this.getConfig();
    if (!config.phoneNumberId || !config.accessToken) {
      return { configured: false };
    }
    try {
      const res = await axios.get(
        `${GRAPH_API_BASE}/${config.phoneNumberId}`,
        {
          headers: { Authorization: `Bearer ${config.accessToken}` },
          timeout: 10000,
        },
      );
      return { configured: true, phoneNumber: res.data };
    } catch (err: any) {
      return {
        configured: false,
        error: err.response?.data?.error?.message || err.message,
      };
    }
  }

  async getStats(): Promise<any> {
    const totalSessions = await this.sessionModel.countDocuments();
    const activeSessions = await this.sessionModel.countDocuments({
      state: { $ne: 'idle' },
    });
    return { totalSessions, activeSessions };
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // HELPERS — Sessão e WiFi
  // ══════════════════════════════════════════════════════════════════════════════

  private async getOrCreateSession(
    phone: string,
    displayName: string,
  ): Promise<WhatsAppSessionDocument> {
    let session = await this.sessionModel.findOne({ phone }).exec();
    if (!session) {
      session = await this.sessionModel.create({
        phone,
        displayName,
        state: 'idle',
        lastActivity: new Date(),
      });
    } else if (displayName && !session.displayName) {
      session.displayName = displayName;
      await session.save();
    }
    return session;
  }

  private async updateSession(
    phone: string,
    updates: Partial<WhatsAppSession>,
  ): Promise<void> {
    await this.sessionModel.findOneAndUpdate(
      { phone },
      { $set: { ...updates, lastActivity: new Date() } },
      { upsert: true },
    ).exec();
  }

  private async resetSession(phone: string): Promise<void> {
    await this.sessionModel.findOneAndUpdate(
      { phone },
      {
        $set: {
          state: 'idle',
          login: null,
          deviceId: null,
          deviceSerial: null,
          ixcClientId: null,
          wifiNetworksJson: null,
          selectedNetworkIndex: null,
          loginAttempts: 0,
          lastActivity: new Date(),
        },
      },
    ).exec();
  }

  private async getWifiNetworks(deviceId: string): Promise<WifiNetwork[]> {
    const networks: WifiNetwork[] = [];
    try {
      const device = await this.genieAcsService.getDevice(deviceId);
      if (!device) return networks;

      // Detecta data model (TR-098 vs TR-181)
      const isTR181 = !!device['Device.DeviceInfo.SoftwareVersion'];
      const paths = isTR181 ? WIFI_PATHS.TR181 : WIFI_PATHS.TR098;

      for (let i = 1; i <= 8; i++) {
        const enablePath = paths.enable(i);
        const ssidPath = paths.ssid(i);
        const passPath = paths.pass(i);

        const enableVal = device[enablePath]?._value ?? device[enablePath]?.value;
        const ssidVal = device[ssidPath]?._value ?? device[ssidPath]?.value;

        if (ssidVal && enableVal !== false && enableVal !== '0') {
          networks.push({
            index: i,
            ssid: String(ssidVal),
            paramPath: passPath,
            ssidPath,
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`Erro ao ler redes WiFi de ${deviceId}: ${err.message}`);
    }
    return networks;
  }
}
