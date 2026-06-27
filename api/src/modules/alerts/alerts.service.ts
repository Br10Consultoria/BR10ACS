import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import * as nodemailer from 'nodemailer';
import { Alert, AlertDocument, AlertType, AlertSeverity } from './schemas/alert.schema';
import { SettingsService } from '../settings/settings.service';
import { LogsService } from '../logs/logs.service';
import { LogCategory } from '../logs/schemas/log.schema';

export interface AlertCreateDto {
  deviceId: string;
  deviceSerial?: string;
  deviceModel?: string;
  pppLogin?: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  // Rastreia dispositivos que já tiveram alerta de offline para evitar duplicatas
  private offlineAlertedDevices = new Set<string>();
  // Rastreia dispositivos que já tiveram alerta de sinal crítico
  private criticalSignalDevices = new Set<string>();

  constructor(
    @InjectModel(Alert.name) private alertModel: Model<AlertDocument>,
    private readonly settingsService: SettingsService,
    private readonly logsService: LogsService,
  ) {}

  async create(dto: AlertCreateDto): Promise<AlertDocument> {
    return this.alertModel.create(dto);
  }

  async findAll(options: {
    page?: number;
    limit?: number;
    acknowledged?: boolean;
    type?: AlertType;
    deviceId?: string;
  } = {}): Promise<{ data: AlertDocument[]; total: number; page: number; pages: number }> {
    const { page = 1, limit = 50, acknowledged, type, deviceId } = options;
    const query: any = {};
    if (acknowledged !== undefined) query.acknowledged = acknowledged;
    if (type) query.type = type;
    if (deviceId) query.deviceId = deviceId;

    const total = await this.alertModel.countDocuments(query);
    const data = await this.alertModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec() as unknown as AlertDocument[];

    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async acknowledge(id: string, userId: string): Promise<AlertDocument | null> {
    return this.alertModel.findByIdAndUpdate(
      id,
      { $set: { acknowledged: true, acknowledgedAt: new Date(), acknowledgedBy: userId } },
      { returnDocument: 'after' },
    ).exec();
  }

  async acknowledgeAll(deviceId?: string): Promise<number> {
    const query: any = { acknowledged: false };
    if (deviceId) query.deviceId = deviceId;
    const result = await this.alertModel.updateMany(query, {
      $set: { acknowledged: true, acknowledgedAt: new Date() },
    });
    return result.modifiedCount;
  }

  async getUnacknowledgedCount(): Promise<number> {
    return this.alertModel.countDocuments({ acknowledged: false });
  }

  /**
   * Processa o status de um dispositivo e cria alertas se necessário.
   * Chamado pelo CollectorService a cada ciclo de coleta.
   */
  async processDeviceStatus(device: {
    id: string;
    serial?: string;
    model?: string;
    pppLogin?: string;
    online: boolean;
    rxPower?: number | null;
  }): Promise<void> {
    const { id, serial, model, pppLogin, online, rxPower } = device;

    // --- Alerta de offline ---
    if (!online) {
      if (!this.offlineAlertedDevices.has(id)) {
        this.offlineAlertedDevices.add(id);
        const alert = await this.create({
          deviceId: id,
          deviceSerial: serial,
          deviceModel: model,
          pppLogin,
          type: AlertType.DEVICE_OFFLINE,
          severity: AlertSeverity.CRITICAL,
          message: `Dispositivo ${serial || id} ficou offline${pppLogin ? ` (PPPoE: ${pppLogin})` : ''}`,
          metadata: { model, serial, pppLogin },
        });
        // Persiste log no MongoDB (visível na tela de Logs)
        await this.logsService.warn(
          alert.message,
          LogCategory.DEVICE,
          { alertId: String(alert._id), type: alert.type, model, serial, pppLogin },
          id,
        ).catch(() => {});
        await this.sendNotifications(alert);
      }
    } else {
      // Dispositivo voltou online — limpa do set e cria alerta de recuperação
      if (this.offlineAlertedDevices.has(id)) {
        this.offlineAlertedDevices.delete(id);
        const alert = await this.create({
          deviceId: id,
          deviceSerial: serial,
          deviceModel: model,
          pppLogin,
          type: AlertType.DEVICE_ONLINE,
          severity: AlertSeverity.INFO,
          message: `Dispositivo ${serial || id} voltou online${pppLogin ? ` (PPPoE: ${pppLogin})` : ''}`,
          metadata: { model, serial, pppLogin },
        });
        await this.logsService.info(
          alert.message,
          LogCategory.DEVICE,
          { alertId: String(alert._id), type: alert.type, model, serial, pppLogin },
          id,
        ).catch(() => {});
        await this.sendNotifications(alert);
      }
    }

    // --- Alerta de sinal crítico (RX < -27 dBm) ---
    if (online && rxPower !== null && rxPower !== undefined) {
      if (rxPower < -27) {
        if (!this.criticalSignalDevices.has(id)) {
          this.criticalSignalDevices.add(id);
          const alert = await this.create({
            deviceId: id,
            deviceSerial: serial,
            deviceModel: model,
            pppLogin,
            type: AlertType.SIGNAL_CRITICAL,
            severity: AlertSeverity.WARNING,
            message: `Sinal crítico em ${serial || id}: RX ${rxPower.toFixed(2)} dBm (limiar: -27 dBm)${pppLogin ? ` | PPPoE: ${pppLogin}` : ''}`,
            metadata: { rxPower, model, serial, pppLogin },
          });
          await this.logsService.warn(
            alert.message,
            LogCategory.DEVICE,
            { alertId: String(alert._id), type: alert.type, rxPower, model, serial, pppLogin },
            id,
          ).catch(() => {});
          await this.sendNotifications(alert);
        }
      } else {
        // Sinal recuperado
        if (this.criticalSignalDevices.has(id)) {
          this.criticalSignalDevices.delete(id);
          const alert = await this.create({
            deviceId: id,
            deviceSerial: serial,
            deviceModel: model,
            pppLogin,
            type: AlertType.SIGNAL_RECOVERED,
            severity: AlertSeverity.INFO,
            message: `Sinal recuperado em ${serial || id}: RX ${rxPower.toFixed(2)} dBm${pppLogin ? ` | PPPoE: ${pppLogin}` : ''}`,
            metadata: { rxPower, model, serial, pppLogin },
          });
          await this.logsService.info(
            alert.message,
            LogCategory.DEVICE,
            { alertId: String(alert._id), type: alert.type, rxPower, model, serial, pppLogin },
            id,
          ).catch(() => {});
          await this.sendNotifications(alert);
        }
      }
    }
  }

  /**
   * Envia notificações para os canais configurados, respeitando os eventos habilitados por canal.
   */
  private async sendNotifications(alert: AlertDocument): Promise<void> {
    try {
      await this.sendTelegram(alert);
      await this.sendWebhook(alert);
      await this.sendEmail(alert);
      await this.alertModel.findByIdAndUpdate(alert._id, {
        $set: { notified: true, notifiedAt: new Date() },
      });
    } catch (err: any) {
      this.logger.error(`Erro ao enviar notificação para alerta ${alert._id}: ${err?.message}`);
      await this.logsService.error(
        `Falha ao enviar notificação do alerta ${alert.type}: ${err?.message}`,
        LogCategory.SYSTEM,
        { alertId: String(alert._id), error: err?.message },
        alert.deviceId,
      ).catch(() => {});
    }
  }

  /**
   * Verifica se o evento do alerta está habilitado para um canal específico.
   * Busca a lista de eventos configurados em notifications.events.<canal>
   */
  private async isEventEnabledForChannel(alertType: AlertType, channel: 'telegram' | 'webhook' | 'email'): Promise<boolean> {
    const defaultsByChannel: Record<string, AlertType[]> = {
      telegram: [AlertType.DEVICE_OFFLINE, AlertType.SIGNAL_CRITICAL],
      webhook:  [AlertType.DEVICE_OFFLINE, AlertType.DEVICE_ONLINE, AlertType.SIGNAL_CRITICAL, AlertType.SIGNAL_RECOVERED],
      email:    [AlertType.DEVICE_OFFLINE, AlertType.SIGNAL_CRITICAL],
    };

    const configured = await this.settingsService.get<AlertType[]>(
      `notifications.events.${channel}`,
      defaultsByChannel[channel],
    );

    // Garante que é array (pode ter sido salvo como string JSON)
    const list: AlertType[] = Array.isArray(configured)
      ? configured
      : (typeof configured === 'string' ? JSON.parse(configured) : defaultsByChannel[channel]);

    return list.includes(alertType);
  }

  private async sendTelegram(alert: AlertDocument): Promise<void> {
    const enabled = await this.settingsService.get<boolean>('notifications.telegram.enabled', false);
    if (!enabled) return;

    if (!(await this.isEventEnabledForChannel(alert.type, 'telegram'))) {
      this.logger.debug(`Telegram: evento '${alert.type}' não habilitado para este canal`);
      return;
    }

    const botToken = await this.settingsService.get<string>('notifications.telegram.botToken') || process.env.TELEGRAM_BOT_TOKEN;
    const chatId   = await this.settingsService.get<string>('notifications.telegram.chatId')   || process.env.TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) return;

    const emoji = alert.severity === AlertSeverity.CRITICAL ? '🔴' :
                  alert.severity === AlertSeverity.WARNING  ? '🟡' : '🟢';
    const typeLabel: Record<string, string> = {
      device_offline: '📴 Dispositivo Offline',
      device_online: '✅ Dispositivo Online',
      signal_critical: '⚠️ Sinal Crítico',
      signal_recovered: '📶 Sinal Recuperado',
    };
    const label = typeLabel[alert.type] || alert.type;
    const ts = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const text = [
      `${emoji} <b>BR10ACS — ${label}</b>`,
      ``,
      alert.message,
      ``,
      `<i>${ts}</i>`,
    ].join('\n');

    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }, { timeout: 15000 });
      this.logger.debug(`Telegram: alerta '${alert.type}' enviado para chat ${chatId}`);
      await this.logsService.info(
        `Telegram: alerta '${alert.type}' enviado — ${alert.deviceSerial || alert.deviceId}`,
        LogCategory.SYSTEM,
        { channel: 'telegram', alertType: alert.type, chatId },
        alert.deviceId,
      ).catch(() => {});
    } catch (err: any) {
      this.logger.warn(`Telegram falhou: ${err?.message}`);
      await this.logsService.warn(
        `Telegram: falha ao enviar alerta '${alert.type}' — ${err?.message}`,
        LogCategory.SYSTEM,
        { channel: 'telegram', alertType: alert.type, error: err?.message },
        alert.deviceId,
      ).catch(() => {});
    }
  }

  private async sendWebhook(alert: AlertDocument): Promise<void> {
    const enabled = await this.settingsService.get<boolean>('notifications.webhook.enabled', false);
    if (!enabled) return;

    if (!(await this.isEventEnabledForChannel(alert.type, 'webhook'))) {
      this.logger.debug(`Webhook: evento '${alert.type}' não habilitado para este canal`);
      return;
    }

    const webhookUrl = await this.settingsService.get<string>('notifications.webhook.url') || process.env.ALERT_WEBHOOK_URL;
    const secret     = await this.settingsService.get<string>('notifications.webhook.secret');
    if (!webhookUrl) return;

    const payload = {
      event: alert.type,
      severity: alert.severity,
      message: alert.message,
      deviceId: alert.deviceId,
      deviceSerial: alert.deviceSerial,
      deviceModel: alert.deviceModel,
      pppLogin: alert.pppLogin,
      metadata: alert.metadata,
      timestamp: new Date().toISOString(),
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secret) headers['X-BR10ACS-Secret'] = secret;

    try {
      await axios.post(webhookUrl, payload, { headers, timeout: 8000 });
      this.logger.debug(`Webhook: alerta '${alert.type}' enviado para ${webhookUrl}`);
      await this.logsService.info(
        `Webhook: alerta '${alert.type}' enviado — ${alert.deviceSerial || alert.deviceId}`,
        LogCategory.SYSTEM,
        { channel: 'webhook', alertType: alert.type, url: webhookUrl },
        alert.deviceId,
      ).catch(() => {});
    } catch (err: any) {
      this.logger.warn(`Webhook falhou: ${err?.message}`);
      await this.logsService.warn(
        `Webhook: falha ao enviar alerta '${alert.type}' — ${err?.message}`,
        LogCategory.SYSTEM,
        { channel: 'webhook', alertType: alert.type, error: err?.message },
        alert.deviceId,
      ).catch(() => {});
    }
  }

  private async sendEmail(alert: AlertDocument): Promise<void> {
    const enabled = await this.settingsService.get<boolean>('notifications.smtp.enabled', false);
    if (!enabled) return;

    if (!(await this.isEventEnabledForChannel(alert.type, 'email'))) {
      this.logger.debug(`E-mail: evento '${alert.type}' não habilitado para este canal`);
      return;
    }

    const host   = await this.settingsService.get<string>('notifications.smtp.host');
    const port   = await this.settingsService.get<number>('notifications.smtp.port', 587);
    const secure = await this.settingsService.get<boolean>('notifications.smtp.secure', false);
    const user   = await this.settingsService.get<string>('notifications.smtp.user');
    const pass   = await this.settingsService.get<string>('notifications.smtp.pass');
    const from   = await this.settingsService.get<string>('notifications.smtp.from') || user;
    const to     = await this.settingsService.get<string>('notifications.smtp.to');

    if (!host || !user || !pass || !to) {
      this.logger.debug('SMTP: configuração incompleta, pulando envio de e-mail');
      return;
    }

    const emoji = alert.severity === AlertSeverity.CRITICAL ? '🔴' :
                  alert.severity === AlertSeverity.WARNING  ? '🟡' : '🟢';
    const subject = `${emoji} BR10ACS — ${alert.type.replace(/_/g, ' ')} — ${alert.deviceSerial || alert.deviceId}`;
    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1e293b;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="margin:0;font-size:18px">BR10ACS — Alerta do Sistema</h2>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
          <p style="font-size:16px;color:#0f172a;margin-top:0">${alert.message}</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:6px 0;color:#64748b;width:140px">Severidade</td><td style="color:#0f172a">${alert.severity}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b">Tipo</td><td style="color:#0f172a">${alert.type}</td></tr>
            ${alert.deviceSerial ? `<tr><td style="padding:6px 0;color:#64748b">Serial</td><td style="color:#0f172a">${alert.deviceSerial}</td></tr>` : ''}
            ${alert.deviceModel  ? `<tr><td style="padding:6px 0;color:#64748b">Modelo</td><td style="color:#0f172a">${alert.deviceModel}</td></tr>` : ''}
            ${alert.pppLogin     ? `<tr><td style="padding:6px 0;color:#64748b">PPPoE</td><td style="color:#0f172a">${alert.pppLogin}</td></tr>` : ''}
            <tr><td style="padding:6px 0;color:#64748b">Data/Hora</td><td style="color:#0f172a">${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td></tr>
          </table>
        </div>
      </div>`;

    try {
      const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
      await transporter.sendMail({ from, to, subject, html });
      this.logger.debug(`SMTP: e-mail de alerta '${alert.type}' enviado para ${to}`);
      await this.logsService.info(
        `E-mail: alerta '${alert.type}' enviado para ${to} — ${alert.deviceSerial || alert.deviceId}`,
        LogCategory.SYSTEM,
        { channel: 'email', alertType: alert.type, to },
        alert.deviceId,
      ).catch(() => {});
    } catch (err: any) {
      this.logger.warn(`SMTP falhou: ${err?.message}`);
      await this.logsService.warn(
        `E-mail: falha ao enviar alerta '${alert.type}' — ${err?.message}`,
        LogCategory.SYSTEM,
        { channel: 'email', alertType: alert.type, error: err?.message },
        alert.deviceId,
      ).catch(() => {});
    }
  }

  async cleanOldAlerts(daysToKeep = 30): Promise<number> {
    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const result = await this.alertModel.deleteMany({
      createdAt: { $lt: cutoff },
      acknowledged: true,
    });
    return result.deletedCount;
  }
}
