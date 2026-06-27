import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import axios from 'axios';
import { SettingsService } from '../settings/settings.service';
import { LogsService } from '../logs/logs.service';
import { LogCategory } from '../logs/schemas/log.schema';
import { Backup, BackupDocument } from './schemas/backup.schema';

const execAsync = promisify(exec);

export interface BackupResult {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: Date;
  status: 'success' | 'error';
  errorMessage?: string;
  cloudUploaded?: boolean;
  cloudProvider?: string;
  cloudUrl?: string;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir = '/tmp/br10acs-backups';

  constructor(
    @InjectModel(Backup.name) private backupModel: Model<BackupDocument>,
    private readonly settingsService: SettingsService,
    private readonly logsService: LogsService,
  ) {
    // Garante que o diretório de backup existe
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // ─── Agendamento automático ───────────────────────────────────────────────

  @Cron('0 2 * * *') // Diário às 02:00
  async scheduledDailyBackup() {
    const enabled = await this.settingsService.get<boolean>('backup.schedule.daily.enabled', false);
    if (!enabled) return;
    this.logger.log('Executando backup diário agendado...');
    await this.runBackup('scheduled-daily');
  }

  @Cron('0 2 * * 0') // Semanal aos domingos às 02:00
  async scheduledWeeklyBackup() {
    const enabled = await this.settingsService.get<boolean>('backup.schedule.weekly.enabled', false);
    if (!enabled) return;
    this.logger.log('Executando backup semanal agendado...');
    await this.runBackup('scheduled-weekly');
  }

  @Cron('0 2 1 * *') // Mensal no dia 1 às 02:00
  async scheduledMonthlyBackup() {
    const enabled = await this.settingsService.get<boolean>('backup.schedule.monthly.enabled', false);
    if (!enabled) return;
    this.logger.log('Executando backup mensal agendado...');
    await this.runBackup('scheduled-monthly');
  }

  // ─── Backup manual ────────────────────────────────────────────────────────

  async runBackup(triggeredBy = 'manual'): Promise<BackupResult> {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://mongo:27017/br10';
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `br10acs-backup-${ts}.gz`;
    const filePath = path.join(this.backupDir, filename);

    let record: BackupDocument | null = null;

    try {
      // Cria registro inicial no banco
      record = await this.backupModel.create({
        filename,
        triggeredBy,
        status: 'running',
        startedAt: new Date(),
      });

      // Executa mongodump e comprime
      const dumpDir = path.join(this.backupDir, `dump-${ts}`);
      await execAsync(`mongodump --uri="${mongoUri}" --out="${dumpDir}" --quiet`);

      // Comprime o dump em .tar.gz
      await execAsync(`tar -czf "${filePath}" -C "${this.backupDir}" "dump-${ts}"`);

      // Remove o diretório temporário
      await execAsync(`rm -rf "${dumpDir}"`);

      const stat = fs.statSync(filePath);
      const sizeBytes = stat.size;

      // Atualiza o registro
      await this.backupModel.findByIdAndUpdate(record._id, {
        $set: { status: 'success', completedAt: new Date(), sizeBytes, filePath },
      });

      await this.logsService.info(
        `Backup concluído: ${filename} (${this.formatSize(sizeBytes)})`,
        LogCategory.SYSTEM,
        { triggeredBy, filename, sizeBytes },
      ).catch(() => {});

      // Upload para cloud se configurado
      let cloudUploaded = false;
      let cloudProvider: string | undefined;
      let cloudUrl: string | undefined;

      const cloudEnabled = await this.settingsService.get<boolean>('backup.cloud.enabled', false);
      if (cloudEnabled) {
        const result = await this.uploadToCloud(filePath, filename);
        cloudUploaded = result.success;
        cloudProvider = result.provider;
        cloudUrl = result.url;

        if (cloudUploaded) {
          await this.backupModel.findByIdAndUpdate(record._id, {
            $set: { cloudUploaded: true, cloudProvider, cloudUrl },
          });
        }
      }

      // Limpa backups antigos (mantém últimos N)
      await this.cleanOldBackups();

      return {
        id: String(record._id),
        filename,
        sizeBytes,
        createdAt: new Date(),
        status: 'success',
        cloudUploaded,
        cloudProvider,
        cloudUrl,
      };
    } catch (err: any) {
      this.logger.error(`Backup falhou: ${err.message}`);

      if (record) {
        await this.backupModel.findByIdAndUpdate(record._id, {
          $set: { status: 'error', completedAt: new Date(), errorMessage: err.message },
        });
      }

      await this.logsService.error(
        `Backup falhou: ${err.message}`,
        LogCategory.SYSTEM,
        { triggeredBy, error: err.message },
      ).catch(() => {});

      // Limpa arquivo parcial se existir
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      return {
        id: record ? String(record._id) : 'unknown',
        filename,
        sizeBytes: 0,
        createdAt: new Date(),
        status: 'error',
        errorMessage: err.message,
      };
    }
  }

  async listBackups(limit = 20): Promise<BackupDocument[]> {
    return this.backupModel
      .find()
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean()
      .exec() as unknown as BackupDocument[];
  }

  async getBackupFilePath(id: string): Promise<string | null> {
    const record = await this.backupModel.findById(id).lean().exec() as any;
    if (!record || !record.filePath) return null;
    if (!fs.existsSync(record.filePath)) return null;
    return record.filePath;
  }

  async deleteBackup(id: string): Promise<void> {
    const record = await this.backupModel.findById(id).lean().exec() as any;
    if (record?.filePath && fs.existsSync(record.filePath)) {
      fs.unlinkSync(record.filePath);
    }
    await this.backupModel.findByIdAndDelete(id);
  }

  async getScheduleConfig() {
    return {
      daily: {
        enabled: await this.settingsService.get<boolean>('backup.schedule.daily.enabled', false),
        time: await this.settingsService.get<string>('backup.schedule.daily.time', '02:00'),
      },
      weekly: {
        enabled: await this.settingsService.get<boolean>('backup.schedule.weekly.enabled', false),
        dayOfWeek: await this.settingsService.get<number>('backup.schedule.weekly.dayOfWeek', 0),
        time: await this.settingsService.get<string>('backup.schedule.weekly.time', '02:00'),
      },
      monthly: {
        enabled: await this.settingsService.get<boolean>('backup.schedule.monthly.enabled', false),
        dayOfMonth: await this.settingsService.get<number>('backup.schedule.monthly.dayOfMonth', 1),
        time: await this.settingsService.get<string>('backup.schedule.monthly.time', '02:00'),
      },
      retentionDays: await this.settingsService.get<number>('backup.retentionDays', 30),
      cloud: {
        enabled: await this.settingsService.get<boolean>('backup.cloud.enabled', false),
        provider: await this.settingsService.get<string>('backup.cloud.provider', ''),
        dropbox: {
          accessToken: await this.settingsService.get<string>('backup.cloud.dropbox.accessToken', ''),
        },
        gdrive: {
          serviceAccountJson: await this.settingsService.get<string>('backup.cloud.gdrive.serviceAccountJson', ''),
          folderId: await this.settingsService.get<string>('backup.cloud.gdrive.folderId', ''),
        },
        s3: {
          bucket: await this.settingsService.get<string>('backup.cloud.s3.bucket', ''),
          region: await this.settingsService.get<string>('backup.cloud.s3.region', ''),
          accessKeyId: await this.settingsService.get<string>('backup.cloud.s3.accessKeyId', ''),
          secretAccessKey: await this.settingsService.get<string>('backup.cloud.s3.secretAccessKey', ''),
        },
        webhookUrl: await this.settingsService.get<string>('backup.cloud.webhookUrl', ''),
      },
    };
  }

  // ─── Upload para cloud ────────────────────────────────────────────────────

  private async uploadToCloud(
    filePath: string,
    filename: string,
  ): Promise<{ success: boolean; provider?: string; url?: string; error?: string }> {
    const provider = await this.settingsService.get<string>('backup.cloud.provider', '');

    try {
      if (provider === 'dropbox') {
        return await this.uploadToDropbox(filePath, filename);
      } else if (provider === 'gdrive') {
        return await this.uploadToGDrive(filePath, filename);
      } else if (provider === 's3') {
        return await this.uploadToS3(filePath, filename);
      } else if (provider === 'webhook') {
        return await this.uploadViaWebhook(filePath, filename);
      }
      return { success: false, error: 'Nenhum provedor cloud configurado' };
    } catch (err: any) {
      this.logger.warn(`Upload cloud falhou: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  private async uploadToDropbox(
    filePath: string,
    filename: string,
  ): Promise<{ success: boolean; provider: string; url?: string; error?: string }> {
    const accessToken = await this.settingsService.get<string>('backup.cloud.dropbox.accessToken', '');
    if (!accessToken) return { success: false, provider: 'dropbox', error: 'Token Dropbox não configurado' };

    const fileContent = fs.readFileSync(filePath);
    const response = await axios.post(
      'https://content.dropboxapi.com/2/files/upload',
      fileContent,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Dropbox-API-Arg': JSON.stringify({
            path: `/BR10ACS-Backups/${filename}`,
            mode: 'add',
            autorename: true,
          }),
          'Content-Type': 'application/octet-stream',
        },
        timeout: 120000,
        maxBodyLength: Infinity,
      },
    );

    return {
      success: true,
      provider: 'dropbox',
      url: response.data?.path_display,
    };
  }

  private async uploadToGDrive(
    filePath: string,
    filename: string,
  ): Promise<{ success: boolean; provider: string; url?: string; error?: string }> {
    // Upload via Google Drive API v3 com service account
    const serviceAccountJson = await this.settingsService.get<string>('backup.cloud.gdrive.serviceAccountJson', '');
    const folderId = await this.settingsService.get<string>('backup.cloud.gdrive.folderId', '');

    if (!serviceAccountJson) {
      return { success: false, provider: 'gdrive', error: 'Service Account JSON não configurado' };
    }

    // Obtém token de acesso via JWT do service account
    const sa = JSON.parse(serviceAccountJson);
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/drive.file',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })).toString('base64url');

    const { createSign } = await import('crypto');
    const sign = createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(sa.private_key, 'base64url');
    const jwt = `${header}.${payload}.${signature}`;

    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    });
    const accessToken = tokenResponse.data.access_token;

    // Upload multipart
    const fileContent = fs.readFileSync(filePath);
    const metadata = JSON.stringify({
      name: filename,
      parents: folderId ? [folderId] : [],
    });

    const boundary = '-------314159265358979323846';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`),
      fileContent,
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const uploadResponse = await axios.post(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      body,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`,
        },
        timeout: 120000,
        maxBodyLength: Infinity,
      },
    );

    return {
      success: true,
      provider: 'gdrive',
      url: `https://drive.google.com/file/d/${uploadResponse.data.id}/view`,
    };
  }

  private async uploadToS3(
    filePath: string,
    filename: string,
  ): Promise<{ success: boolean; provider: string; url?: string; error?: string }> {
    const bucket = await this.settingsService.get<string>('backup.cloud.s3.bucket', '');
    const region = await this.settingsService.get<string>('backup.cloud.s3.region', 'us-east-1');
    const accessKeyId = await this.settingsService.get<string>('backup.cloud.s3.accessKeyId', '');
    const secretAccessKey = await this.settingsService.get<string>('backup.cloud.s3.secretAccessKey', '');

    if (!bucket || !accessKeyId || !secretAccessKey) {
      return { success: false, provider: 's3', error: 'Credenciais S3 incompletas' };
    }

    const fileContent = fs.readFileSync(filePath);
    const key = `BR10ACS-Backups/${filename}`;
    const host = `${bucket}.s3.${region}.amazonaws.com`;
    const url = `https://${host}/${key}`;

    // Assinatura AWS Signature V4
    const { createHmac, createHash } = await import('crypto');
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const contentHash = createHash('sha256').update(fileContent).digest('hex');

    const canonicalRequest = [
      'PUT',
      `/${key}`,
      '',
      `host:${host}\nx-amz-content-sha256:${contentHash}\nx-amz-date:${timeStr}\n`,
      'host;x-amz-content-sha256;x-amz-date',
      contentHash,
    ].join('\n');

    const credentialScope = `${dateStr}/us-east-1/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      timeStr,
      credentialScope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const hmac = (key: Buffer, data: string) => createHmac('sha256', key).update(data).digest();
    const signingKey = hmac(
      hmac(hmac(hmac(Buffer.from(`AWS4${secretAccessKey}`), dateStr), region), 's3'),
      'aws4_request',
    );
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    await axios.put(url, fileContent, {
      headers: {
        Host: host,
        'x-amz-date': timeStr,
        'x-amz-content-sha256': contentHash,
        Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${signature}`,
        'Content-Type': 'application/gzip',
      },
      timeout: 120000,
      maxBodyLength: Infinity,
    });

    return { success: true, provider: 's3', url };
  }

  private async uploadViaWebhook(
    filePath: string,
    filename: string,
  ): Promise<{ success: boolean; provider: string; url?: string; error?: string }> {
    const webhookUrl = await this.settingsService.get<string>('backup.cloud.webhookUrl', '');
    if (!webhookUrl) return { success: false, provider: 'webhook', error: 'URL do webhook não configurada' };

    const fileContent = fs.readFileSync(filePath);
    const base64 = fileContent.toString('base64');

    await axios.post(webhookUrl, {
      filename,
      sizeBytes: fileContent.length,
      data: base64,
      timestamp: new Date().toISOString(),
    }, { timeout: 60000 });

    return { success: true, provider: 'webhook' };
  }

  // ─── Limpeza de backups antigos ───────────────────────────────────────────

  private async cleanOldBackups(): Promise<void> {
    const retentionDays = await this.settingsService.get<number>('backup.retentionDays', 30);
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const old = await this.backupModel.find({
      startedAt: { $lt: cutoff },
      status: 'success',
    }).lean().exec() as any[];

    for (const b of old) {
      if (b.filePath && fs.existsSync(b.filePath)) {
        fs.unlinkSync(b.filePath);
      }
      await this.backupModel.findByIdAndDelete(b._id);
    }

    if (old.length > 0) {
      this.logger.log(`Limpeza: ${old.length} backups antigos removidos`);
    }
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
