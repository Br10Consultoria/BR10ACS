/**
 * TelegramBotService — Autoatendimento via Telegram para assinantes.
 *
 * Fluxo principal (troca de senha WiFi):
 *   1. Cliente envia /start ou "trocar senha wifi"
 *   2. Bot solicita o login PPPoE ou CPF do cliente
 *   3. Bot busca o cliente no IXC e localiza o dispositivo no GenieACS
 *   4. Bot solicita a nova senha WiFi
 *   5. Bot aplica a senha via TR-069 (setParameterValues)
 *   6. Bot confirma a alteração
 *
 * Comandos disponíveis:
 *   /start       — Exibe menu de autoatendimento
 *   /wifi        — Inicia fluxo de troca de senha WiFi
 *   /status      — Consulta status do dispositivo
 *   /cancelar    — Cancela a operação atual
 *   /ajuda       — Exibe ajuda
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { SettingsService } from '../settings/settings.service';
import { LogsService } from '../logs/logs.service';
import { LogCategory } from '../logs/schemas/log.schema';
import { GenieAcsService } from '../genieacs/genieacs.service';
import { Integration, IntegrationDocument } from '../integrations/schemas/integration.schema';
import { IxcService } from '../integrations/ixc.service';

// ── Tipos de sessão conversacional ───────────────────────────────────────────

type BotState =
  | 'idle'
  | 'waiting_login'          // aguardando login PPPoE/CPF
  | 'waiting_new_password'   // aguardando nova senha WiFi
  | 'waiting_ssid_choice';   // aguardando escolha de SSID (2.4/5 GHz)

interface BotSession {
  state: BotState;
  chatId: number;
  userId?: number;
  username?: string;
  login?: string;             // login PPPoE identificado
  deviceId?: string;          // ID do dispositivo no GenieACS
  deviceSerial?: string;
  ixcClientId?: string;
  ixcContractId?: string;
  wifiNetworks?: WifiNetwork[];
  selectedNetworkIndex?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface WifiNetwork {
  index: number;
  ssid: string;
  paramPath: string;   // caminho TR-069 do KeyPassphrase
  ssidPath: string;    // caminho TR-069 do SSID
}

// ── Serviço ───────────────────────────────────────────────────────────────────

@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);

  /** Sessões ativas em memória (TTL de 10 minutos) */
  private sessions = new Map<number, BotSession>();

  /** Intervalo de limpeza de sessões expiradas */
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly logsService: LogsService,
    private readonly genieAcsService: GenieAcsService,
    private readonly ixcService: IxcService,
    @InjectModel(Integration.name) private integrationModel: Model<IntegrationDocument>,
  ) {
    // Limpa sessões expiradas a cada 2 minutos
    this.cleanupInterval = setInterval(() => this.cleanExpiredSessions(), 2 * 60 * 1000);
  }

  // ── Ponto de entrada do webhook ──────────────────────────────────────────

  async handleUpdate(update: any): Promise<void> {
    try {
      const message = update?.message || update?.edited_message;
      if (!message) return;

      const chatId: number = message.chat?.id;
      const text: string = (message.text || '').trim();
      const userId: number = message.from?.id;
      const username: string = message.from?.username || message.from?.first_name || '';

      if (!chatId || !text) return;

      this.logger.debug(`Mensagem de ${username} (${chatId}): "${text}"`);

      await this.processMessage(chatId, userId, username, text);
    } catch (err: any) {
      this.logger.error(`Erro ao processar update do Telegram: ${err.message}`);
    }
  }

  // ── Processamento de mensagens ────────────────────────────────────────────

  private async processMessage(
    chatId: number,
    userId: number,
    username: string,
    text: string,
  ): Promise<void> {
    const session = this.getOrCreateSession(chatId, userId, username);
    const lower = text.toLowerCase();

    // Comandos globais (funcionam em qualquer estado)
    if (lower === '/cancelar' || lower === 'cancelar') {
      this.clearSession(chatId);
      await this.send(chatId, '✅ Operação cancelada. Digite /start para começar novamente.');
      return;
    }

    if (lower === '/start' || lower === 'oi' || lower === 'olá' || lower === 'ola') {
      this.clearSession(chatId);
      await this.sendMenu(chatId, username);
      return;
    }

    if (lower === '/ajuda' || lower === 'ajuda' || lower === 'help') {
      await this.sendHelp(chatId);
      return;
    }

    // Roteamento por estado da sessão
    switch (session.state) {
      case 'idle':
        await this.handleIdleState(chatId, session, text, lower);
        break;
      case 'waiting_login':
        await this.handleLoginInput(chatId, session, text);
        break;
      case 'waiting_ssid_choice':
        await this.handleSsidChoice(chatId, session, text);
        break;
      case 'waiting_new_password':
        await this.handleNewPassword(chatId, session, text);
        break;
      default:
        await this.sendMenu(chatId, username);
    }
  }

  // ── Handlers de estado ────────────────────────────────────────────────────

  private async handleIdleState(
    chatId: number,
    session: BotSession,
    text: string,
    lower: string,
  ): Promise<void> {
    if (lower === '/wifi' || lower === '1' || lower.includes('senha') || lower.includes('wifi') || lower.includes('wi-fi')) {
      session.state = 'waiting_login';
      session.updatedAt = new Date();
      await this.send(chatId,
        '📶 <b>Troca de Senha WiFi</b>\n\n' +
        'Para identificar seu contrato, informe seu <b>login PPPoE</b> (ex: <code>cliente123</code>).\n\n' +
        'Digite /cancelar para voltar ao menu.',
      );
      return;
    }

    if (lower === '/status' || lower === '2' || lower.includes('status') || lower.includes('dispositivo')) {
      session.state = 'waiting_login';
      session.updatedAt = new Date();
      // Reutiliza o fluxo de login mas com ação diferente
      (session as any).action = 'status';
      await this.send(chatId,
        '🔍 <b>Status do Dispositivo</b>\n\n' +
        'Informe seu <b>login PPPoE</b> para consultar o status.\n\n' +
        'Digite /cancelar para voltar ao menu.',
      );
      return;
    }

    await this.sendMenu(chatId, session.username || '');
  }

  private async handleLoginInput(chatId: number, session: BotSession, login: string): Promise<void> {
    await this.send(chatId, '🔍 Buscando seu contrato, aguarde...');

    try {
      // Busca a integração IXC ativa
      const ixcIntegration = await this.integrationModel.findOne({
        type: { $in: ['ixc', 'ixc-csnet'] },
        enabled: true,
      }).exec();

      if (!ixcIntegration) {
        await this.send(chatId,
          '⚠️ Serviço temporariamente indisponível. Por favor, entre em contato com o suporte.',
        );
        this.clearSession(chatId);
        return;
      }

      // Busca usuário no IXC pelo login PPPoE
      const ixcResult = await this.ixcService.lookupRadUser(
        String(ixcIntegration._id),
        { login: login.trim() },
      );

      if (!ixcResult.found || !ixcResult.data) {
        await this.send(chatId,
          `❌ Login <code>${this.escapeHtml(login)}</code> não encontrado.\n\n` +
          'Verifique se digitou corretamente e tente novamente, ou digite /cancelar.',
        );
        return;
      }

      const radUser = ixcResult.data;
      session.login = login.trim();
      session.ixcClientId = radUser.id_cliente;
      session.ixcContractId = radUser.id_contrato;

      // Busca o dispositivo no GenieACS pelo MAC da ONT ou login PPPoE
      const deviceId = await this.findDeviceInGenieAcs(radUser);

      if (!deviceId) {
        await this.send(chatId,
          '⚠️ Dispositivo não encontrado no sistema de gerenciamento.\n\n' +
          'Pode ser que o roteador esteja offline ou não esteja registrado. ' +
          'Entre em contato com o suporte se o problema persistir.',
        );
        this.clearSession(chatId);
        return;
      }

      session.deviceId = deviceId;
      session.updatedAt = new Date();

      // Se a ação for status, mostra o status e encerra
      if ((session as any).action === 'status') {
        await this.showDeviceStatus(chatId, deviceId, login);
        this.clearSession(chatId);
        return;
      }

      // Busca as redes WiFi disponíveis no dispositivo
      const wifiNetworks = await this.getWifiNetworks(deviceId);

      if (!wifiNetworks || wifiNetworks.length === 0) {
        await this.send(chatId,
          '⚠️ Não foi possível obter as redes WiFi do dispositivo.\n\n' +
          'O dispositivo pode estar offline. Tente novamente mais tarde.',
        );
        this.clearSession(chatId);
        return;
      }

      session.wifiNetworks = wifiNetworks;

      if (wifiNetworks.length === 1) {
        // Apenas uma rede, vai direto para a senha
        session.selectedNetworkIndex = 0;
        session.state = 'waiting_new_password';
        session.updatedAt = new Date();
        await this.send(chatId,
          `✅ Contrato encontrado!\n\n` +
          `📶 Rede WiFi: <b>${this.escapeHtml(wifiNetworks[0].ssid || 'Sem nome')}</b>\n\n` +
          `Digite a <b>nova senha WiFi</b> (mínimo 8 caracteres):\n\n` +
          `<i>Digite /cancelar para voltar ao menu.</i>`,
        );
      } else {
        // Múltiplas redes, pede para escolher
        session.state = 'waiting_ssid_choice';
        session.updatedAt = new Date();
        const networkList = wifiNetworks
          .map((n, i) => `${i + 1}. ${this.escapeHtml(n.ssid || `Rede ${i + 1}`)}`)
          .join('\n');
        await this.send(chatId,
          `✅ Contrato encontrado!\n\n` +
          `Foram encontradas <b>${wifiNetworks.length} redes WiFi</b>. Qual deseja alterar?\n\n` +
          `${networkList}\n\n` +
          `Digite o <b>número</b> da rede desejada:`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Erro ao buscar login ${login}: ${err.message}`);
      await this.send(chatId,
        '❌ Ocorreu um erro ao consultar o sistema. Tente novamente mais tarde.',
      );
      this.clearSession(chatId);
    }
  }

  private async handleSsidChoice(chatId: number, session: BotSession, text: string): Promise<void> {
    const choice = parseInt(text.trim(), 10);
    const networks = session.wifiNetworks || [];

    if (isNaN(choice) || choice < 1 || choice > networks.length) {
      await this.send(chatId,
        `❌ Opção inválida. Digite um número entre 1 e ${networks.length}.`,
      );
      return;
    }

    session.selectedNetworkIndex = choice - 1;
    session.state = 'waiting_new_password';
    session.updatedAt = new Date();

    const network = networks[choice - 1];
    await this.send(chatId,
      `📶 Rede selecionada: <b>${this.escapeHtml(network.ssid || `Rede ${choice}`)}</b>\n\n` +
      `Digite a <b>nova senha WiFi</b> (mínimo 8 caracteres):\n\n` +
      `<i>A senha não pode conter espaços. Digite /cancelar para voltar.</i>`,
    );
  }

  private async handleNewPassword(chatId: number, session: BotSession, password: string): Promise<void> {
    const pwd = password.trim();

    // Validações
    if (pwd.length < 8) {
      await this.send(chatId, '❌ A senha deve ter pelo menos 8 caracteres. Tente novamente:');
      return;
    }
    if (pwd.includes(' ')) {
      await this.send(chatId, '❌ A senha não pode conter espaços. Tente novamente:');
      return;
    }
    if (pwd.length > 63) {
      await this.send(chatId, '❌ A senha deve ter no máximo 63 caracteres. Tente novamente:');
      return;
    }

    const { deviceId, wifiNetworks, selectedNetworkIndex } = session;
    if (!deviceId || !wifiNetworks || selectedNetworkIndex === undefined) {
      await this.send(chatId, '❌ Sessão expirada. Digite /start para começar novamente.');
      this.clearSession(chatId);
      return;
    }

    const network = wifiNetworks[selectedNetworkIndex];
    await this.send(chatId, '⏳ Aplicando nova senha, aguarde...');

    try {
      // Aplica a senha via TR-069
      await this.genieAcsService.setParameterValues(deviceId, [
        [network.paramPath, pwd, 'xsd:string'],
      ]);

      // Registra no log do sistema
      await this.logsService.info(
        `Senha WiFi alterada via Telegram Bot — SSID: ${network.ssid} — Login: ${session.login}`,
        LogCategory.DEVICE,
        {
          chatId,
          login: session.login,
          ssid: network.ssid,
          deviceId,
          source: 'telegram-bot',
        },
        deviceId,
      ).catch(() => {});

      await this.send(chatId,
        `✅ <b>Senha WiFi alterada com sucesso!</b>\n\n` +
        `📶 Rede: <b>${this.escapeHtml(network.ssid || 'WiFi')}</b>\n` +
        `🔑 Nova senha: <code>${this.escapeHtml(pwd)}</code>\n\n` +
        `<i>Aguarde alguns segundos para que o dispositivo aplique a nova configuração.</i>\n\n` +
        `Digite /start para realizar outra operação.`,
      );

      this.clearSession(chatId);
    } catch (err: any) {
      this.logger.error(`Erro ao alterar senha WiFi via bot: ${err.message}`);
      await this.send(chatId,
        '❌ Não foi possível alterar a senha no momento. ' +
        'O dispositivo pode estar offline. Tente novamente mais tarde.',
      );
      this.clearSession(chatId);
    }
  }

  // ── Helpers de dispositivo ────────────────────────────────────────────────

  /**
   * Localiza o dispositivo no GenieACS pelo MAC da ONT ou pelo login PPPoE
   * armazenado nos tags/parâmetros do dispositivo.
   */
  private async findDeviceInGenieAcs(radUser: any): Promise<string | null> {
    try {
      // Tenta pelo MAC da ONT
      if (radUser.onu_mac) {
        const macNormalized = radUser.onu_mac.replace(/[:-]/g, '').toUpperCase();
        const devices = await this.genieAcsService.getDevices(
          { '_deviceId._OUI': { $regex: macNormalized.slice(0, 6), $options: 'i' } },
          ['_id', '_deviceId'],
        );
        if (devices.length > 0) return devices[0]._id;
      }

      // Tenta pelo MAC do rádio
      if (radUser.mac) {
        const macNormalized = radUser.mac.replace(/[:-]/g, '').toUpperCase();
        const devices = await this.genieAcsService.getDevices(
          { '_deviceId._OUI': { $regex: macNormalized.slice(0, 6), $options: 'i' } },
          ['_id', '_deviceId'],
        );
        if (devices.length > 0) return devices[0]._id;
      }

      // Tenta pelo IP do cliente (menos preciso)
      if (radUser.ip) {
        const devices = await this.genieAcsService.getDevices(
          {
            $or: [
              { 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress._value': radUser.ip },
              { 'Device.IP.Interface.1.IPv4Address.1.IPAddress._value': radUser.ip },
            ],
          },
          ['_id', '_deviceId'],
        );
        if (devices.length > 0) return devices[0]._id;
      }

      return null;
    } catch (err: any) {
      this.logger.warn(`Erro ao buscar dispositivo no GenieACS: ${err.message}`);
      return null;
    }
  }

  /**
   * Obtém as redes WiFi disponíveis no dispositivo via GenieACS.
   * Suporta TR-098 (InternetGatewayDevice) e TR-181 (Device).
   */
  private async getWifiNetworks(deviceId: string): Promise<WifiNetwork[]> {
    try {
      const device = await this.genieAcsService.getDevice(deviceId);
      if (!device) return [];

      const networks: WifiNetwork[] = [];

      // TR-098: InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}
      const lanDevice = device['InternetGatewayDevice']?.['LANDevice'];
      if (lanDevice) {
        for (const lanKey of Object.keys(lanDevice)) {
          if (!/^\d+$/.test(lanKey)) continue;
          const wlanConf = lanDevice[lanKey]?.['WLANConfiguration'];
          if (!wlanConf) continue;
          for (const wlanKey of Object.keys(wlanConf)) {
            if (!/^\d+$/.test(wlanKey)) continue;
            const wlan = wlanConf[wlanKey];
            const ssid = wlan?.SSID?._value || '';
            const enabled = wlan?.Enable?._value;
            if (enabled === false || enabled === '0') continue;
            networks.push({
              index: networks.length,
              ssid,
              paramPath: `InternetGatewayDevice.LANDevice.${lanKey}.WLANConfiguration.${wlanKey}.KeyPassphrase`,
              ssidPath: `InternetGatewayDevice.LANDevice.${lanKey}.WLANConfiguration.${wlanKey}.SSID`,
            });
          }
        }
      }

      // TR-181: Device.WiFi.AccessPoint.{i}
      const wifiAP = device['Device']?.['WiFi']?.['AccessPoint'];
      if (wifiAP && networks.length === 0) {
        const ssidTable = device['Device']?.['WiFi']?.['SSID'] || {};
        for (const apKey of Object.keys(wifiAP)) {
          if (!/^\d+$/.test(apKey)) continue;
          const ap = wifiAP[apKey];
          const ssidRef = ap?.SSIDReference?._value || '';
          // Extrai o índice do SSID da referência (ex: "Device.WiFi.SSID.1.")
          const ssidIndexMatch = ssidRef.match(/SSID\.(\d+)/);
          const ssidIndex = ssidIndexMatch ? ssidIndexMatch[1] : apKey;
          const ssid = ssidTable[ssidIndex]?.SSID?._value || '';
          const enabled = ssidTable[ssidIndex]?.Enable?._value;
          if (enabled === false || enabled === '0') continue;
          networks.push({
            index: networks.length,
            ssid,
            paramPath: `Device.WiFi.AccessPoint.${apKey}.Security.PreSharedKey`,
            ssidPath: `Device.WiFi.SSID.${ssidIndex}.SSID`,
          });
        }
      }

      return networks;
    } catch (err: any) {
      this.logger.warn(`Erro ao obter redes WiFi de ${deviceId}: ${err.message}`);
      return [];
    }
  }

  /**
   * Mostra o status do dispositivo (online/offline, sinal, uptime).
   */
  private async showDeviceStatus(chatId: number, deviceId: string, login: string): Promise<void> {
    try {
      const device = await this.genieAcsService.getDevice(deviceId, [
        '_id', '_lastInform', '_deviceId',
        'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress',
        'Device.IP.Interface.1.IPv4Address.1.IPAddress',
      ]);

      if (!device) {
        await this.send(chatId, '⚠️ Dispositivo não encontrado.');
        return;
      }

      const lastInform = device._lastInform ? new Date(device._lastInform) : null;
      const now = new Date();
      const diffMs = lastInform ? now.getTime() - lastInform.getTime() : Infinity;
      const diffMin = Math.floor(diffMs / 60000);
      const isOnline = diffMs < 5 * 60 * 1000; // online se informou nos últimos 5 min

      const statusEmoji = isOnline ? '🟢' : '🔴';
      const statusText = isOnline ? 'Online' : 'Offline';
      const lastSeenText = lastInform
        ? lastInform.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        : 'Nunca';

      const ip =
        device['InternetGatewayDevice']?.WANDevice?.['1']?.WANConnectionDevice?.['1']?.WANIPConnection?.['1']?.ExternalIPAddress?._value ||
        device['Device']?.IP?.Interface?.['1']?.IPv4Address?.['1']?.IPAddress?._value ||
        'N/D';

      await this.send(chatId,
        `${statusEmoji} <b>Status do Dispositivo</b>\n\n` +
        `Login: <code>${this.escapeHtml(login)}</code>\n` +
        `Status: <b>${statusText}</b>\n` +
        `IP WAN: <code>${this.escapeHtml(ip)}</code>\n` +
        `Último contato: ${lastSeenText}\n` +
        (isOnline ? '' : `<i>Offline há ${diffMin} minuto(s)</i>\n`) +
        `\nDigite /start para outras opções.`,
      );
    } catch (err: any) {
      await this.send(chatId, '❌ Erro ao consultar status. Tente novamente mais tarde.');
    }
  }

  // ── Mensagens padrão ──────────────────────────────────────────────────────

  private async sendMenu(chatId: number, username: string): Promise<void> {
    const name = username ? ` ${this.escapeHtml(username)}` : '';
    await this.send(chatId,
      `👋 Olá${name}! Bem-vindo ao <b>Atendimento BR10</b>.\n\n` +
      `O que você deseja fazer?\n\n` +
      `1️⃣ /wifi — Trocar senha do WiFi\n` +
      `2️⃣ /status — Verificar status da conexão\n\n` +
      `<i>Digite o número ou o comando desejado.</i>`,
    );
  }

  private async sendHelp(chatId: number): Promise<void> {
    await this.send(chatId,
      `ℹ️ <b>Ajuda — Autoatendimento BR10</b>\n\n` +
      `<b>Comandos disponíveis:</b>\n` +
      `/start — Menu principal\n` +
      `/wifi — Trocar senha do WiFi\n` +
      `/status — Status da conexão\n` +
      `/cancelar — Cancelar operação atual\n` +
      `/ajuda — Esta mensagem\n\n` +
      `<b>Dúvidas?</b> Entre em contato com o suporte técnico.`,
    );
  }

  // ── API do Telegram ───────────────────────────────────────────────────────

  async send(chatId: number, text: string): Promise<void> {
    const botToken = await this.settingsService.get<string>('notifications.telegram.botToken')
      || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      this.logger.warn('Bot token não configurado — mensagem não enviada');
      return;
    }

    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }, { timeout: 15000 });
    } catch (err: any) {
      this.logger.warn(`Erro ao enviar mensagem para chat ${chatId}: ${err.message}`);
    }
  }

  /**
   * Registra o webhook do Telegram Bot na URL pública do sistema.
   * Deve ser chamado após configurar o botToken e a URL pública.
   */
  async registerWebhook(publicUrl: string): Promise<{ ok: boolean; description?: string }> {
    const botToken = await this.settingsService.get<string>('notifications.telegram.botToken')
      || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return { ok: false, description: 'Bot token não configurado' };

    const webhookUrl = `${publicUrl.replace(/\/$/, '')}/api/v1/telegram/webhook`;
    try {
      const res = await axios.post(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        url: webhookUrl,
        allowed_updates: ['message'],
        drop_pending_updates: true,
      }, { timeout: 15000 });
      this.logger.log(`Webhook registrado: ${webhookUrl}`);
      return res.data;
    } catch (err: any) {
      this.logger.error(`Erro ao registrar webhook: ${err.message}`);
      return { ok: false, description: err.message };
    }
  }

  /**
   * Remove o webhook do Telegram (útil para desenvolvimento/polling).
   */
  async deleteWebhook(): Promise<{ ok: boolean }> {
    const botToken = await this.settingsService.get<string>('notifications.telegram.botToken')
      || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return { ok: false };
    try {
      const res = await axios.post(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {}, { timeout: 10000 });
      return res.data;
    } catch {
      return { ok: false };
    }
  }

  /**
   * Obtém informações do webhook atual.
   */
  async getWebhookInfo(): Promise<any> {
    const botToken = await this.settingsService.get<string>('notifications.telegram.botToken')
      || process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return { ok: false, description: 'Bot token não configurado' };
    try {
      const res = await axios.get(`https://api.telegram.org/bot${botToken}/getWebhookInfo`, { timeout: 10000 });
      return res.data;
    } catch (err: any) {
      return { ok: false, description: err.message };
    }
  }

  // ── Gerenciamento de sessões ──────────────────────────────────────────────

  private getOrCreateSession(chatId: number, userId: number, username: string): BotSession {
    const existing = this.sessions.get(chatId);
    if (existing) {
      existing.updatedAt = new Date();
      return existing;
    }
    const session: BotSession = {
      state: 'idle',
      chatId,
      userId,
      username,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(chatId, session);
    return session;
  }

  private clearSession(chatId: number): void {
    this.sessions.delete(chatId);
  }

  private cleanExpiredSessions(): void {
    const ttl = 10 * 60 * 1000; // 10 minutos
    const now = Date.now();
    for (const [chatId, session] of this.sessions.entries()) {
      if (now - session.updatedAt.getTime() > ttl) {
        this.sessions.delete(chatId);
        this.logger.debug(`Sessão expirada removida: chatId ${chatId}`);
      }
    }
  }

  // ── Utilitários ───────────────────────────────────────────────────────────

  private escapeHtml(text: string): string {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
