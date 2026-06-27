import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { Alert, AlertDocument, AlertType, AlertSeverity } from './schemas/alert.schema';
import { SettingsService } from '../settings/settings.service';

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
          await this.sendNotifications(alert);
        }
      } else {
        // Sinal recuperado
        if (this.criticalSignalDevices.has(id)) {
          this.criticalSignalDevices.delete(id);
          await this.create({
            deviceId: id,
            deviceSerial: serial,
            deviceModel: model,
            pppLogin,
            type: AlertType.SIGNAL_RECOVERED,
            severity: AlertSeverity.INFO,
            message: `Sinal recuperado em ${serial || id}: RX ${rxPower.toFixed(2)} dBm${pppLogin ? ` | PPPoE: ${pppLogin}` : ''}`,
            metadata: { rxPower, model, serial, pppLogin },
          });
        }
      }
    }
  }

  /**
   * Envia notificações para integrações configuradas (Telegram, webhook).
   * As integrações são buscadas do banco a cada chamada para respeitar mudanças em tempo real.
   */
  private async sendNotifications(alert: AlertDocument): Promise<void> {
    try {
      // Telegram
      await this.sendTelegram(alert);
      // Webhook genérico
      await this.sendWebhook(alert);
      // Marca como notificado
      await this.alertModel.findByIdAndUpdate(alert._id, {
        $set: { notified: true, notifiedAt: new Date() },
      });
    } catch (err: any) {
      this.logger.error(`Erro ao enviar notificação para alerta ${alert._id}: ${err?.message}`);
    }
  }

  private async sendTelegram(alert: AlertDocument): Promise<void> {
    // Busca configuração do Telegram do banco (Settings) com fallback para env
    const botToken = await this.settingsService.get('notifications.telegram.botToken') as string || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = await this.settingsService.get('notifications.telegram.chatId') as string || process.env.TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) return;

    const emoji = alert.severity === AlertSeverity.CRITICAL ? '🔴' :
                  alert.severity === AlertSeverity.WARNING ? '🟡' : '🟢';
    const text = `${emoji} *BR10ACS Alert*\n\n${alert.message}\n\n_${new Date().toLocaleString('pt-BR', { timeZone: 'America/Bahia' })}_`;

    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }, { timeout: 8000 });
      this.logger.debug(`Telegram: alerta enviado para chat ${chatId}`);
    } catch (err: any) {
      this.logger.warn(`Telegram falhou: ${err?.message}`);
    }
  }

  private async sendWebhook(alert: AlertDocument): Promise<void> {
    const webhookUrl = await this.settingsService.get('notifications.webhook.url') as string || process.env.ALERT_WEBHOOK_URL;
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

    try {
      await axios.post(webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 8000,
      });
      this.logger.debug(`Webhook: alerta enviado para ${webhookUrl}`);
    } catch (err: any) {
      this.logger.warn(`Webhook falhou: ${err?.message}`);
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
