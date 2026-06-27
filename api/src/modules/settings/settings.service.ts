import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Settings, SettingsDocument } from './schemas/settings.schema';

const DEFAULT_SETTINGS = [
  { key: 'system.name', value: 'BR10ACS', description: 'Nome do sistema' },
  { key: 'system.logo', value: '', description: 'URL do logotipo' },
  { key: 'collector.enabled', value: true, description: 'Habilitar coletor de dados' },
  { key: 'collector.interval', value: 300, description: 'Intervalo do coletor em segundos' },
  { key: 'collector.limit', value: 100, description: 'Limite de dispositivos por ciclo' },
  { key: 'collector.offlineAfter', value: 900, description: 'Tempo para considerar offline (segundos)' },
  { key: 'genieacs.nbiUrl', value: 'http://localhost:7557', description: 'URL do GenieACS NBI' },
  { key: 'genieacs.cwmpUrl', value: 'http://localhost:7547', description: 'URL do GenieACS CWMP' },
  { key: 'logs.retentionDays', value: 90, description: 'Retenção de logs em dias' },
  { key: 'timeseries.retentionDays', value: 365, description: 'Retenção de TimeSeries em dias' },
  { key: 'auth.sessionExpireHours', value: 24, description: 'Expiração da sessão em horas' },
  { key: 'auth.maxLoginAttempts', value: 5, description: 'Máximo de tentativas de login' },
  // ── SMTP ──────────────────────────────────────────────────────────────────
  { key: 'notifications.smtp.enabled',  value: false, description: 'Habilitar notificações por e-mail (SMTP)' },
  { key: 'notifications.smtp.host',     value: '', description: 'Servidor SMTP (ex: smtp.gmail.com)' },
  { key: 'notifications.smtp.port',     value: 587, description: 'Porta SMTP (587 para TLS, 465 para SSL, 25 para sem criptografia)' },
  { key: 'notifications.smtp.secure',   value: false, description: 'Usar SSL/TLS na porta 465' },
  { key: 'notifications.smtp.user',     value: '', description: 'Usuário SMTP (geralmente o e-mail de envio)', isSecret: true },
  { key: 'notifications.smtp.pass',     value: '', description: 'Senha SMTP ou App Password', isSecret: true },
  { key: 'notifications.smtp.from',     value: '', description: 'Endereço de e-mail remetente (ex: alertas@suaempresa.com)' },
  { key: 'notifications.smtp.to',       value: '', description: 'Destinatário(s) dos alertas (separe múltiplos com vírgula)' },
  // ── Telegram ──────────────────────────────────────────────────────────────
  { key: 'notifications.telegram.enabled', value: false, description: 'Habilitar notificações via Telegram' },
  { key: 'notifications.telegram.botToken', value: '', description: 'Token do bot do Telegram', isSecret: true },
  { key: 'notifications.telegram.chatId', value: '', description: 'Chat ID do Telegram para receber alertas' },
  // ── Webhook ───────────────────────────────────────────────────────────────
  { key: 'notifications.webhook.enabled', value: false, description: 'Habilitar webhook genérico para alertas' },
  { key: 'notifications.webhook.url', value: '', description: 'URL do webhook para envio de alertas' },
  { key: 'notifications.webhook.secret', value: '', description: 'Secret header para autenticar o webhook', isSecret: true },
  // ── Eventos configuráveis por canal ───────────────────────────────────────
  // Cada chave é um array JSON de tipos de evento que disparam o canal
  // Valores padrão: todos os eventos críticos/warning disparam todos os canais
  {
    key: 'notifications.events.telegram',
    value: ['device_offline', 'signal_critical'],
    description: 'Eventos que disparam notificação no Telegram',
  },
  {
    key: 'notifications.events.webhook',
    value: ['device_offline', 'device_online', 'signal_critical', 'signal_recovered'],
    description: 'Eventos que disparam notificação no Webhook',
  },
  {
    key: 'notifications.events.email',
    value: ['device_offline', 'signal_critical'],
    description: 'Eventos que disparam notificação por e-mail',
  },
  // ── OpenAI ────────────────────────────────────────────────────────────────
  { key: 'openai.apiKey', value: '', description: 'Chave de API da OpenAI para diagnóstico IA', isSecret: true },
  { key: 'openai.baseUrl', value: '', description: 'URL base da API OpenAI (deixe vazio para usar o padrão)' },
];

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);
  private cache: Map<string, any> = new Map();

  constructor(@InjectModel(Settings.name) private settingsModel: Model<SettingsDocument>) {}

  async onModuleInit() {
    await this.seedDefaults();
    await this.loadCache();
  }

  async get<T = any>(key: string, fallback?: T): Promise<T> {
    if (this.cache.has(key)) return this.cache.get(key) as T;
    const doc = await this.settingsModel.findOne({ key }).exec();
    return doc ? (doc.value as T) : (fallback as T);
  }

  async set(key: string, value: any): Promise<SettingsDocument> {
    const doc = await this.settingsModel.findOneAndUpdate(
      { key },
      { $set: { value } },
      { returnDocument: 'after', upsert: true },
    ).exec();
    this.cache.set(key, value);
    return doc;
  }

  async getAll(): Promise<SettingsDocument[]> {
    return this.settingsModel.find().exec();
  }

  async setBulk(settings: { key: string; value: any }[]): Promise<void> {
    for (const s of settings) {
      await this.set(s.key, s.value);
    }
  }

  async getPublicSettings(): Promise<Record<string, any>> {
    const all = await this.settingsModel.find({ isSecret: { $ne: true } }).exec();
    const result: Record<string, any> = {};
    for (const s of all) result[s.key] = s.value;
    return result;
  }

  private async seedDefaults(): Promise<void> {
    for (const def of DEFAULT_SETTINGS) {
      const exists = await this.settingsModel.findOne({ key: def.key }).exec();
      if (!exists) {
        await this.settingsModel.create(def);
        this.logger.debug(`Setting padrão criado: ${def.key}`);
      }
    }
  }

  private async loadCache(): Promise<void> {
    const all = await this.settingsModel.find().exec();
    for (const s of all) this.cache.set(s.key, s.value);
    this.logger.log(`${all.length} configurações carregadas no cache`);
  }
}
