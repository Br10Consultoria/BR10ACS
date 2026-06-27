import { Injectable, Logger, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GenieAcsService, GenieDevice } from '../genieacs/genieacs.service';
import { DeviceNormalizer, NormalizedDevice } from './tr069/device-normalizer';
import { TimeSeries, TimeSeriesDocument } from './schemas/timeseries.schema';
import { LogsService } from '../logs/logs.service';
import { LogCategory } from '../logs/schemas/log.schema';
import { CollectorService } from '../collector/collector.service';

export interface DeviceListOptions {
  page?: number;
  limit?: number;
  search?: string;
  online?: boolean;
  manufacturer?: string;
  model?: string;
  tag?: string;
}

export interface DeviceListResult {
  data: NormalizedDevice[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  // Campos mínimos para listagem (performance)
  private readonly LIST_PROJECTION = [
    '_id',
    '_lastInform',
    '_registered',
    '_tags',
    'DeviceID',
    'InternetGatewayDevice.DeviceInfo.SoftwareVersion',
    'InternetGatewayDevice.DeviceInfo.HardwareVersion',
    'InternetGatewayDevice.DeviceInfo.ModelName',
    'InternetGatewayDevice.DeviceInfo.Manufacturer',
    'InternetGatewayDevice.ManagementServer.ConnectionRequestURL',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.1.ExternalIPAddress',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.1.Username',
    'Device.DeviceInfo.SoftwareVersion',
    'Device.DeviceInfo.ModelName',
    'Device.ManagementServer.ConnectionRequestURL',
  ];

  constructor(
    private genieAcsService: GenieAcsService,
    @InjectModel(TimeSeries.name) private timeSeriesModel: Model<TimeSeriesDocument>,
    private logsService: LogsService,
    @Inject(forwardRef(() => CollectorService)) private collectorService: CollectorService,
  ) {}

  async list(options: DeviceListOptions = {}): Promise<DeviceListResult> {
    const { page = 1, limit = 50, search, online, manufacturer, model, tag } = options;

    const query: any = {};

    if (search) {
      query.$or = [
        { _id: { $regex: search, $options: 'i' } },
        { 'DeviceID._SerialNumber._value': { $regex: search, $options: 'i' } },
        { 'InternetGatewayDevice.DeviceInfo.ModelName._value': { $regex: search, $options: 'i' } },
        { 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress._value': { $regex: search, $options: 'i' } },
        { 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.1.ExternalIPAddress._value': { $regex: search, $options: 'i' } },
      ];
    }

    if (manufacturer) {
      query['DeviceID._Manufacturer._value'] = { $regex: manufacturer, $options: 'i' };
    }

    if (model) {
      query['DeviceID._ProductClass._value'] = { $regex: model, $options: 'i' };
    }

    if (tag) {
      query._tags = tag;
    }

    const devices = await this.genieAcsService.getDevices(query, this.LIST_PROJECTION);
    let normalized = devices.map((d) => DeviceNormalizer.normalize(d));

    if (online !== undefined) {
      normalized = normalized.filter((d) => d.online === online);
    }

    const total = normalized.length;
    const pages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const data = normalized.slice(start, start + limit);

    return { data, total, page, limit, pages };
  }

  async getById(deviceId: string): Promise<NormalizedDevice> {
    const device = await this.genieAcsService.getDevice(deviceId);
    if (!device) throw new NotFoundException(`Dispositivo ${deviceId} não encontrado`);
    return DeviceNormalizer.normalize(device);
  }

  async getRawParams(deviceId: string): Promise<Record<string, any>> {
    const device = await this.genieAcsService.getDeviceRaw(deviceId);
    if (!device) throw new NotFoundException(`Dispositivo ${deviceId} não encontrado`);
    return this.flattenParams(device);
  }

  async reboot(deviceId: string): Promise<any> {
    const result = await this.genieAcsService.reboot(deviceId);
    await this.logsService.warn(`Reboot solicitado para ${deviceId}`, LogCategory.DEVICE, { deviceId }, deviceId).catch(() => {});
    return result;
  }

  async factoryReset(deviceId: string): Promise<any> {
    return this.genieAcsService.factoryReset(deviceId);
  }

  async connectionRequest(deviceId: string): Promise<void> {
    await this.logsService.info(`Connection Request (Sync) enviado para ${deviceId}`, LogCategory.DEVICE, { deviceId }, deviceId).catch(() => {});
    return this.genieAcsService.connectionRequest(deviceId);
  }

  async refresh(deviceId: string): Promise<any> {
    // refreshObject nos principais ramos para forçar coleta de todos os parâmetros
    const branches = [
      'InternetGatewayDevice.DeviceInfo',
      'InternetGatewayDevice.WANDevice',
      'InternetGatewayDevice.LANDevice',
      'InternetGatewayDevice.ManagementServer',
    ];
    const results = await Promise.allSettled(
      branches.map((b) => this.genieAcsService.refreshObject(deviceId, b)),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    await this.logsService.info(`Refresh completo solicitado para ${deviceId} (${ok}/${branches.length} ramos)`, LogCategory.DEVICE, { deviceId, ok, total: branches.length }, deviceId).catch(() => {});

    // Coleta imediata após 15s (dá tempo ao dispositivo de reportar)
    setTimeout(() => {
      this.collectorService.collectDevice(deviceId).catch(() => {});
    }, 15000);

    return { message: `Refresh solicitado: ${ok}/${branches.length} ramos`, deviceId };
  }

  async setParameter(deviceId: string, name: string, value: any, type: string): Promise<any> {
    return this.genieAcsService.setParameterValues(deviceId, [[name, value, type]]);
  }

  async setParameters(deviceId: string, params: { name: string; value: any; type: string }[]): Promise<any> {
    const values: [string, any, string][] = params.map((p) => [p.name, p.value, p.type]);
    return this.genieAcsService.setParameterValues(deviceId, values);
  }

  async addTag(deviceId: string, tag: string): Promise<void> {
    return this.genieAcsService.addTag(deviceId, tag);
  }

  async removeTag(deviceId: string, tag: string): Promise<void> {
    return this.genieAcsService.removeTag(deviceId, tag);
  }

  async delete(deviceId: string): Promise<void> {
    return this.genieAcsService.deleteDevice(deviceId);
  }

  async getTimeSeries(
    serialNumber: string,
    from?: Date,
    to?: Date,
    limit = 100,
  ): Promise<TimeSeriesDocument[]> {
    const query: any = { deviceId: serialNumber };
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = from;
      if (to) query.timestamp.$lte = to;
    }
    return this.timeSeriesModel
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  async saveTimeSeriesSnapshot(device: NormalizedDevice): Promise<void> {
    const hosts5g = device.wifiNetworks.reduce((acc, n) => acc + (n.band === '5GHz' ? n.associated : 0), 0);
    const hosts2g = device.wifiNetworks.reduce((acc, n) => acc + (n.band === '2.4GHz' ? n.associated : 0), 0);
    const hostsEth = device.hosts.filter((h) => h.interfaceType === 'Ethernet').length;

    const snap = new this.timeSeriesModel({
      deviceId: device.serialNumber,
      timestamp: new Date(),
      online: device.online,
      rxDbm: device.rxPower ?? null,
      txDbm: device.txPower ?? null,
      temperature: device.temperature ?? null,
      voltage: device.voltage ?? null,
      totalBytesReceived: device.wanBytesReceived ?? null,
      totalBytesSent: device.wanBytesSent ?? null,
      totalDownloadMB: device.wanBytesReceived ? Math.round(device.wanBytesReceived / 1024 / 1024) : null,
      totalUploadMB: device.wanBytesSent ? Math.round(device.wanBytesSent / 1024 / 1024) : null,
      totalAssociated: hosts5g + hosts2g,
      hostsCount: device.hosts.length,
      uptime: device.uptime ? String(device.uptime) : null,
      linkStatus: null,
    });

    await snap.save();
  }

  async getStats(): Promise<{
    total: number;
    online: number;
    offline: number;
    informedToday: number;
    byManufacturer: { manufacturer: string; count: number }[];
    avgRxDbm: number | null;
    criticalSignal: number;
  }> {
    const devices = await this.genieAcsService.getDevices({}, [
      '_id',
      '_lastInform',
      'DeviceID._Manufacturer',
    ]);

    const normalized = devices.map((d) => DeviceNormalizer.normalize(d));
    const online = normalized.filter((d) => d.online).length;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const informedToday = normalized.filter(
      (d) => d.lastInform && new Date(d.lastInform) > oneDayAgo,
    ).length;

    const mfMap: Record<string, number> = {};
    for (const d of normalized) {
      const m = d.manufacturer || 'Desconhecido';
      mfMap[m] = (mfMap[m] || 0) + 1;
    }
    const byManufacturer = Object.entries(mfMap)
      .map(([manufacturer, count]) => ({ manufacturer, count }))
      .sort((a, b) => b.count - a.count);

    // Dados de sinal óptico via TimeSeries (mais recente por dispositivo)
    const collectorStats = await this.collectorService.getDashboardStats();

    return {
      total: normalized.length,
      online,
      offline: normalized.length - online,
      informedToday,
      byManufacturer,
      avgRxDbm: collectorStats.avgRxDbm,
      criticalSignal: collectorStats.criticalSignal,
    };
  }

  async exportToExcel(options: Omit<DeviceListOptions, 'page' | 'limit'> = {}): Promise<Buffer> {
    const { data } = await this.list({ ...options, limit: 5000 });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'BR10ACS';
    const ws = wb.addWorksheet('Dispositivos');
    ws.columns = [
      { header: 'Serial', key: 'serial', width: 28 },
      { header: 'Fabricante', key: 'manufacturer', width: 16 },
      { header: 'Modelo', key: 'model', width: 16 },
      { header: 'Firmware', key: 'firmware', width: 20 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'IP', key: 'ip', width: 16 },
      { header: 'PPPoE', key: 'pppoe', width: 20 },
      { header: 'Sinal RX (dBm)', key: 'rx', width: 14 },
      { header: 'Sinal TX (dBm)', key: 'tx', width: 14 },
      { header: 'Uptime', key: 'uptime', width: 12 },
      { header: 'Ultimo Inform', key: 'lastInform', width: 22 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    for (const d of data) {
      ws.addRow({
        serial: d.serialNumber || d.id,
        manufacturer: d.manufacturer || '',
        model: d.model || '',
        firmware: d.softwareVersion || '',
        status: d.online ? 'Online' : 'Offline',
        ip: d.ipv4 || '',
        pppoe: d.pppLogin || '',
        rx: d.rxPower ?? '',
        tx: d.txPower ?? '',
        uptime: d.uptime ? Math.round(d.uptime / 3600) + 'h' : '',
        lastInform: d.lastInform ? new Date(d.lastInform).toLocaleString('pt-BR') : '',
      });
    }
    ws.eachRow((row: any, rowNum: number) => {
      if (rowNum === 1) return;
      const statusCell = row.getCell('status');
      if (statusCell.value === 'Offline') {
        row.eachCell((cell: any) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; });
      }
    });
    const buf = await wb.xlsx.writeBuffer();
    return buf as Buffer;
  }

  async exportToPdf(options: Omit<DeviceListOptions, 'page' | 'limit'> = {}): Promise<Buffer> {
    const { data } = await this.list({ ...options, limit: 5000 });
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit');
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.fontSize(16).fillColor('#1E40AF').text('BR10ACS - Relatorio de Dispositivos', { align: 'center' });
      doc.fontSize(9).fillColor('#64748B').text(`Gerado em ${new Date().toLocaleString('pt-BR')} - ${data.length} dispositivos`, { align: 'center' });
      doc.moveDown(0.5);
      const cols = [
        { label: 'Serial', w: 130 }, { label: 'Fabricante', w: 80 }, { label: 'Modelo', w: 80 },
        { label: 'Status', w: 55 }, { label: 'IP', w: 90 }, { label: 'PPPoE', w: 100 },
        { label: 'Sinal RX', w: 60 }, { label: 'Ultimo Inform', w: 110 },
      ];
      const startX = 40;
      let y = doc.y;
      doc.rect(startX, y, cols.reduce((s: number, c: any) => s + c.w, 0), 18).fill('#1E40AF');
      let x = startX;
      doc.fillColor('#FFFFFF').fontSize(8);
      for (const col of cols) {
        doc.text(col.label, x + 3, y + 4, { width: col.w - 6, lineBreak: false });
        x += col.w;
      }
      y += 18;
      doc.fillColor('#1E293B').fontSize(7.5);
      let rowIdx = 0;
      for (const d of data) {
        if (y > 530) { doc.addPage(); y = 40; }
        const bg = rowIdx % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
        const totalW = cols.reduce((s: number, c: any) => s + c.w, 0);
        doc.rect(startX, y, totalW, 16).fill(bg);
        x = startX;
        const row = [
          d.serialNumber || d.id || '',
          d.manufacturer || '',
          d.model || '',
          d.online ? 'Online' : 'Offline',
          d.ipv4 || '',
          d.pppLogin || '',
          d.rxPower != null ? `${d.rxPower} dBm` : '-',
          d.lastInform ? new Date(d.lastInform).toLocaleString('pt-BR') : '-',
        ];
        doc.fillColor(d.online ? '#1E293B' : '#DC2626');
        for (let i = 0; i < cols.length; i++) {
          doc.text(row[i], x + 3, y + 3, { width: cols[i].w - 6, lineBreak: false });
          x += cols[i].w;
        }
        y += 16;
        rowIdx++;
      }
      doc.end();
    });
  }

  private calculateWifiScore(device: NormalizedDevice): number | null {
    if (!device.wifiNetworks.length) return null;
    let score = 100;
    if (device.rxPower !== null && device.rxPower < -25) score -= 20;
    if (device.wifiNetworks.every((n) => !n.enabled)) score -= 30;
    return Math.max(0, Math.min(100, score));
  }

  private flattenParams(device: GenieDevice): Record<string, any> {
    const result: Record<string, any> = {};
    const skip = new Set(['_id', '_lastInform', '_registered', '_tags', '_deviceId', 'DeviceID']);

    const flatten = (obj: any, prefix = '') => {
      if (!obj || typeof obj !== 'object') return;
      for (const key of Object.keys(obj)) {
        if (key === '_value' || key === '_writable' || key === '_timestamp' || key === '_type') continue;
        if (!prefix && skip.has(key)) continue;
        const path = prefix ? `${prefix}.${key}` : key;
        const val = obj[key];
        if (val && typeof val === 'object' && '_value' in val) {
          result[path] = {
            value: val._value,
            writable: val._writable || false,
            type: val._type || null,
            timestamp: val._timestamp ? new Date(val._timestamp) : null,
          };
        } else if (val && typeof val === 'object' && !Array.isArray(val)) {
          flatten(val, path);
        }
      }
    };

    flatten(device);
    return result;
  }
}
