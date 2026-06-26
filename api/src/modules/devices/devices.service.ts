import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GenieAcsService, GenieDevice } from '../genieacs/genieacs.service';
import { DeviceNormalizer, NormalizedDevice } from './tr069/device-normalizer';
import { TimeSeries, TimeSeriesDocument } from './schemas/timeseries.schema';

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
    return this.genieAcsService.reboot(deviceId);
  }

  async factoryReset(deviceId: string): Promise<any> {
    return this.genieAcsService.factoryReset(deviceId);
  }

  async connectionRequest(deviceId: string): Promise<void> {
    return this.genieAcsService.connectionRequest(deviceId);
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
    const query: any = { serialNumber };
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }
    return this.timeSeriesModel
      .find(query)
      .sort({ date: -1 })
      .limit(limit)
      .exec();
  }

  async saveTimeSeriesSnapshot(device: NormalizedDevice): Promise<void> {
    const hosts5g = device.wifiNetworks.reduce((acc, n) => acc + (n.band === '5GHz' ? n.associated : 0), 0);
    const hosts2g = device.wifiNetworks.reduce((acc, n) => acc + (n.band === '2.4GHz' ? n.associated : 0), 0);
    const hostsEth = device.hosts.filter((h) => h.interfaceType === 'Ethernet').length;

    const snap = new this.timeSeriesModel({
      serialNumber: device.serialNumber,
      date: new Date(),
      rx: device.rxPower,
      tx: device.txPower,
      temperature: device.temperature,
      voltage: device.voltage,
      connectedHosts: {
        '5ghz': hosts5g,
        '2ghz': hosts2g,
        ethernet: hostsEth,
        total: device.hosts.length,
      },
      wifiScore: this.calculateWifiScore(device),
      wanDownload: device.wanBytesReceived || 0,
      wanUpload: device.wanBytesSent || 0,
      cpuUsage: device.cpuUsage,
      memoryFree: device.memoryFree,
    });

    await snap.save();
  }

  async getStats(): Promise<{
    total: number;
    online: number;
    offline: number;
    manufacturers: Record<string, number>;
  }> {
    const devices = await this.genieAcsService.getDevices({}, [
      '_id',
      '_lastInform',
      'DeviceID._Manufacturer',
    ]);

    const normalized = devices.map((d) => DeviceNormalizer.normalize(d));
    const online = normalized.filter((d) => d.online).length;
    const manufacturers: Record<string, number> = {};

    for (const d of normalized) {
      const m = d.manufacturer || 'Desconhecido';
      manufacturers[m] = (manufacturers[m] || 0) + 1;
    }

    return {
      total: normalized.length,
      online,
      offline: normalized.length - online,
      manufacturers,
    };
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
