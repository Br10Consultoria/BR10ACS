import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import * as os from 'os';
import { License, LicenseDocument, LicenseStatus } from './schemas/license.schema';

export interface LicenseInfo {
  status: LicenseStatus;
  key: string;
  holderName: string;
  holderEmail: string;
  plan: string;
  expiresAt: string | null;
  daysRemaining: number | null;
  maxDevices: number;
  lastCheckedAt: string | null;
  instanceId: string;
  message: string;
}

@Injectable()
export class LicenseService implements OnModuleInit {
  private readonly logger = new Logger(LicenseService.name);

  /** URL do servidor externo de licenças */
  private readonly licenseServerUrl: string;

  /** Fingerprint único desta instalação */
  private readonly instanceId: string;

  /** Cache em memória do status atual */
  private cachedStatus: LicenseStatus = 'pending';

  constructor(
    @InjectModel(License.name) private readonly licenseModel: Model<LicenseDocument>,
  ) {
    this.licenseServerUrl =
      process.env.LICENSE_SERVER_URL || 'https://licenses.br10.com.br/api/v1';
    this.instanceId = this.generateInstanceId();
  }

  async onModuleInit(): Promise<void> {
    // Carrega o status do banco ao iniciar
    const license = await this.licenseModel.findOne().sort({ createdAt: -1 }).exec();
    if (license) {
      this.cachedStatus = license.status;
      this.logger.log(
        `Licença carregada: ${license.key} — status: ${license.status}`,
      );
    } else {
      this.logger.warn('Nenhuma licença registrada. Sistema em modo trial.');
    }
  }

  /**
   * Gera um fingerprint único para esta instalação baseado em hostname + CPU + MAC.
   */
  private generateInstanceId(): string {
    const hostname = os.hostname();
    const cpuModel = os.cpus()[0]?.model || 'unknown';
    const raw = `${hostname}|${cpuModel}`;
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
  }

  /**
   * Retorna informações completas da licença ativa.
   */
  async getLicenseInfo(): Promise<LicenseInfo> {
    const license = await this.licenseModel.findOne().sort({ createdAt: -1 }).exec();

    if (!license) {
      return {
        status: 'pending',
        key: '',
        holderName: '',
        holderEmail: '',
        plan: 'trial',
        expiresAt: null,
        daysRemaining: null,
        maxDevices: 10,
        lastCheckedAt: null,
        instanceId: this.instanceId,
        message: 'Nenhuma licença registrada. O sistema está em modo trial (máx. 10 dispositivos).',
      };
    }

    const daysRemaining = license.expiresAt
      ? Math.max(
          0,
          Math.ceil(
            (new Date(license.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          ),
        )
      : null;

    const message = this.buildStatusMessage(license.status, daysRemaining);

    return {
      status: license.status,
      key: this.maskKey(license.key),
      holderName: license.holderName || '',
      holderEmail: license.holderEmail || '',
      plan: license.plan || 'standard',
      expiresAt: license.expiresAt ? license.expiresAt.toISOString() : null,
      daysRemaining,
      maxDevices: license.maxDevices || 0,
      lastCheckedAt: license.lastCheckedAt
        ? license.lastCheckedAt.toISOString()
        : null,
      instanceId: this.instanceId,
      message,
    };
  }

  /**
   * Registra ou atualiza uma chave de licença e valida imediatamente no servidor.
   */
  async activateLicense(key: string): Promise<LicenseInfo> {
    this.logger.log(`Ativando licença: ${key}`);

    // Remove licenças anteriores
    await this.licenseModel.deleteMany({});

    // Cria registro pendente
    const license = await this.licenseModel.create({
      key,
      status: 'pending',
      instanceId: this.instanceId,
      lastCheckedAt: new Date(),
    });

    // Valida no servidor externo
    const validated = await this.validateWithServer(key);

    if (validated) {
      license.status = validated.status;
      license.expiresAt = validated.expiresAt ? new Date(validated.expiresAt) : undefined;
      license.holderName = validated.holderName || '';
      license.holderEmail = validated.holderEmail || '';
      license.plan = validated.plan || 'standard';
      license.maxDevices = validated.maxDevices || 0;
      license.serverResponse = validated as unknown as Record<string, unknown>;
      license.lastCheckedAt = new Date();
    } else {
      license.status = 'invalid';
    }

    await license.save();
    this.cachedStatus = license.status;

    return this.getLicenseInfo();
  }

  /**
   * Força uma nova verificação com o servidor de licenças.
   */
  async refreshLicense(): Promise<LicenseInfo> {
    const license = await this.licenseModel.findOne().sort({ createdAt: -1 }).exec();

    if (!license) {
      throw new Error('Nenhuma licença registrada para atualizar.');
    }

    this.logger.log(`Atualizando licença: ${license.key}`);

    const validated = await this.validateWithServer(license.key);

    if (validated) {
      license.status = validated.status;
      license.expiresAt = validated.expiresAt ? new Date(validated.expiresAt) : undefined;
      license.holderName = validated.holderName || license.holderName;
      license.holderEmail = validated.holderEmail || license.holderEmail;
      license.plan = validated.plan || license.plan;
      license.maxDevices = validated.maxDevices ?? license.maxDevices;
      license.serverResponse = validated as unknown as Record<string, unknown>;
    } else {
      // Servidor indisponível — mantém status atual mas registra tentativa
      this.logger.warn('Servidor de licenças indisponível. Mantendo status atual.');
    }

    license.lastCheckedAt = new Date();
    await license.save();
    this.cachedStatus = license.status;

    return this.getLicenseInfo();
  }

  /**
   * Remove a licença registrada.
   */
  async removeLicense(): Promise<void> {
    await this.licenseModel.deleteMany({});
    this.cachedStatus = 'pending';
    this.logger.log('Licença removida.');
  }

  /**
   * Retorna o status atual em cache (rápido, sem consulta ao banco).
   */
  getCachedStatus(): LicenseStatus {
    return this.cachedStatus;
  }

  /**
   * Verifica periodicamente a validade da licença (a cada 24 horas).
   */
  @Cron('0 3 * * *') // Todos os dias às 3h da manhã
  async scheduledCheck(): Promise<void> {
    this.logger.log('Verificação agendada de licença...');
    try {
      await this.refreshLicense();
    } catch (err) {
      this.logger.warn(`Verificação agendada falhou: ${err.message}`);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Comunica com o servidor externo de licenças.
   * Retorna null se o servidor estiver indisponível.
   */
  private async validateWithServer(key: string): Promise<{
    status: LicenseStatus;
    expiresAt?: string;
    holderName?: string;
    holderEmail?: string;
    plan?: string;
    maxDevices?: number;
  } | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.licenseServerUrl}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          instanceId: this.instanceId,
          product: 'BR10ACS',
          version: process.env.npm_package_version || '1.0.0',
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        this.logger.warn(
          `Servidor de licenças retornou status ${response.status}`,
        );
        return null;
      }

      const data = await response.json() as {
        valid: boolean;
        status?: LicenseStatus;
        expiresAt?: string;
        holderName?: string;
        holderEmail?: string;
        plan?: string;
        maxDevices?: number;
      };

      return {
        status: data.valid ? (data.status || 'active') : 'invalid',
        expiresAt: data.expiresAt,
        holderName: data.holderName,
        holderEmail: data.holderEmail,
        plan: data.plan,
        maxDevices: data.maxDevices,
      };
    } catch (err) {
      this.logger.warn(`Falha ao contatar servidor de licenças: ${err.message}`);
      return null;
    }
  }

  private maskKey(key: string): string {
    if (!key || key.length < 8) return '****';
    return key.substring(0, 4) + '****' + key.substring(key.length - 4);
  }

  private buildStatusMessage(status: LicenseStatus, daysRemaining: number | null): string {
    switch (status) {
      case 'active':
        if (daysRemaining !== null && daysRemaining <= 7) {
          return `Licença ativa. Expira em ${daysRemaining} dia(s). Renove em breve!`;
        }
        return daysRemaining !== null
          ? `Licença ativa. Válida por mais ${daysRemaining} dia(s).`
          : 'Licença ativa.';
      case 'expired':
        return 'Licença expirada. Renove para continuar usando o sistema.';
      case 'invalid':
        return 'Chave de licença inválida. Verifique a chave e tente novamente.';
      case 'trial':
        return 'Modo trial ativo. Limitado a 10 dispositivos.';
      case 'pending':
      default:
        return 'Aguardando validação da licença.';
    }
  }
}
