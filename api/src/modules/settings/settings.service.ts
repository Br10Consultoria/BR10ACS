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
  { key: 'notifications.email.enabled', value: false, description: 'Habilitar notificações por e-mail' },
  { key: 'notifications.email.smtp', value: '', description: 'Servidor SMTP', isSecret: true },
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
      { new: true, upsert: true },
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
