import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { TimeSeries, TimeSeriesDocument } from '../devices/schemas/timeseries.schema';
import { GenieAcsService } from '../genieacs/genieacs.service';
import { DeviceNormalizer } from '../devices/tr069/device-normalizer';

@Injectable()
export class CollectorService implements OnModuleDestroy {
  private readonly logger = new Logger(CollectorService.name);
  private collectTimer: NodeJS.Timeout | null = null;
  private historyTimer: NodeJS.Timeout | null = null;
  private isCollecting = false;

  constructor(
    @InjectModel(TimeSeries.name) private readonly tsModel: Model<TimeSeriesDocument>,
    private readonly genieAcs: GenieAcsService,
    private readonly config: ConfigService,
  ) {}

  onModuleDestroy() {
    this.stop();
  }

  start() {
    const intervalMs = (this.config.get<number>('COLLECTOR_INTERVAL', 300)) * 1000;
    const historyMs  = (this.config.get<number>('COLLECTOR_HISTORY_INTERVAL', 3600)) * 1000;

    this.logger.log(`Coletor iniciado — intervalo: ${intervalMs / 1000}s, histórico: ${historyMs / 1000}s`);

    // Primeira coleta imediata
    this.collect().catch(err => this.logger.error('Erro na coleta inicial:', err.message));

    // Coleta periódica de dados em tempo real
    this.collectTimer = setInterval(() => {
      if (!this.isCollecting) {
        this.collect().catch(err => this.logger.error('Erro na coleta:', err.message));
      }
    }, intervalMs);

    // Coleta periódica de histórico (mais espaçada)
    this.historyTimer = setInterval(() => {
      this.collectHistory().catch(err => this.logger.error('Erro no histórico:', err.message));
    }, historyMs);
  }

  stop() {
    if (this.collectTimer) { clearInterval(this.collectTimer); this.collectTimer = null; }
    if (this.historyTimer) { clearInterval(this.historyTimer); this.historyTimer = null; }
    this.logger.log('Coletor parado.');
  }

  async collect(): Promise<{ collected: number; errors: number }> {
    this.isCollecting = true;
    let collected = 0;
    let errors = 0;
    const now = new Date();

    try {
      // Busca todos os dispositivos online do GenieACS via NBI
      const devices = await this.genieAcs.getDevices({}, [
        '_id', 'DeviceID', 'Events',
          'InternetGatewayDevice.WANDevice',
          'InternetGatewayDevice.LANDevice',
          'InternetGatewayDevice.DeviceInfo.UpTime',
          'Device.DeviceInfo.UpTime',
          'InternetGatewayDevice.WANDevice.1.X_HW_GponInterfaceConfig',
          'InternetGatewayDevice.WANDevice.1.X_ZTE_GponInterfaceConfig',
          'InternetGatewayDevice.WANDevice.1.X_ALCL_GponInterfaceConfig',
          'InternetGatewayDevice.WANDevice.1.X_ITBS_PONInterfaceConfig',
          'InternetGatewayDevice.WANDevice.1.X_FH_GponInterfaceConfig',
      ]);

      for (const rawDevice of devices) {
        try {
          const normalized = DeviceNormalizer.normalize(rawDevice);
          if (!normalized?.id) continue;

          const offlineAfter = this.config.get<number>('COLLECTOR_OFFLINE_AFTER', 900);
          const isOnline = normalized.ageSeconds !== undefined
            ? normalized.ageSeconds < offlineAfter
            : false;

          // Monta o documento de TimeSeries
          const rxMb = normalized.wanBytesReceived ? normalized.wanBytesReceived / (1024 * 1024) : null;
          const txMb = normalized.wanBytesSent ? normalized.wanBytesSent / (1024 * 1024) : null;
          const tsDoc = {
            deviceId: normalized.id,
            timestamp: now,
            online: isOnline,
            rxDbm: normalized.rxPower ?? null,
            txDbm: normalized.txPower ?? null,
            temperature: normalized.temperature ?? null,
            voltage: normalized.voltage ?? null,
            totalBytesReceived: normalized.wanBytesReceived ?? null,
            totalBytesSent: normalized.wanBytesSent ?? null,
            totalDownloadMB: rxMb !== null ? Math.round(rxMb * 100) / 100 : null,
            totalUploadMB: txMb !== null ? Math.round(txMb * 100) / 100 : null,
            totalAssociated: normalized.wifiNetworks?.reduce((a, w) => a + (w.associated ?? 0), 0) ?? 0,
            hostsCount: normalized.hosts?.length ?? 0,
            uptime: normalized.uptime ?? null,
            linkStatus: normalized.pppConnectionStatus ?? null,
          };

          // Upsert: um documento por dispositivo por intervalo de 5 minutos
          const bucketTime = new Date(Math.floor(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000));
          await this.tsModel.updateOne(
            { deviceId: normalized.id, timestamp: bucketTime },
            { $set: tsDoc },
            { upsert: true },
          );

          collected++;
        } catch (devErr: unknown) {
          errors++;
          const msg = devErr instanceof Error ? devErr.message : String(devErr);
          this.logger.warn(`Erro ao coletar dispositivo: ${msg}`);
        }
      }

      if (collected > 0) {
        this.logger.debug(`Coleta concluída: ${collected} dispositivos, ${errors} erros`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Falha na coleta geral: ${msg}`);
    } finally {
      this.isCollecting = false;
    }

    return { collected, errors };
  }

  async collectHistory(): Promise<void> {
    // Limpa registros de TimeSeries com mais de 30 dias
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.tsModel.deleteMany({ timestamp: { $lt: cutoff } });
    if (result.deletedCount > 0) {
      this.logger.log(`Histórico: ${result.deletedCount} registros antigos removidos`);
    }
  }

  async getDeviceHistory(deviceId: string, hours = 24): Promise<TimeSeriesDocument[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.tsModel
      .find({ deviceId, timestamp: { $gte: since } })
      .sort({ timestamp: 1 })
      .limit(1000)
      .lean()
      .exec() as unknown as TimeSeriesDocument[];
  }

  async getDashboardStats(): Promise<{
    totalDevices: number;
    onlineDevices: number;
    offlineDevices: number;
    avgRxDbm: number | null;
    criticalSignal: number;
  }> {
    const offlineAfter = this.config.get<number>('COLLECTOR_OFFLINE_AFTER', 900);
    const since = new Date(Date.now() - offlineAfter * 1000 * 2);

    // Pega o último snapshot de cada dispositivo
    const pipeline = [
      { $match: { timestamp: { $gte: since } } } as any,
      { $sort: { timestamp: -1 as const } } as any,
      { $group: { _id: '$deviceId', doc: { $first: '$$ROOT' } } } as any,
      { $replaceRoot: { newRoot: '$doc' } } as any,
    ];

    const snapshots = await this.tsModel.aggregate(pipeline).exec();

    let online = 0, offline = 0, rxSum = 0, rxCount = 0, critical = 0;
    for (const s of snapshots) {
      if (s.online) online++; else offline++;
      if (s.rxDbm !== null && s.rxDbm !== undefined) {
        rxSum += s.rxDbm;
        rxCount++;
        if (s.rxDbm < -27) critical++;
      }
    }

    return {
      totalDevices: snapshots.length,
      onlineDevices: online,
      offlineDevices: offline,
      avgRxDbm: rxCount > 0 ? Math.round((rxSum / rxCount) * 10) / 10 : null,
      criticalSignal: critical,
    };
  }
}
