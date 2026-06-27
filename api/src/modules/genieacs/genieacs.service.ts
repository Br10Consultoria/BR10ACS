import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface GenieDevice {
  _id: string;
  _deviceId?: {
    _Manufacturer?: { _value: string };
    _OUI?: { _value: string };
    _ProductClass?: { _value: string };
    _SerialNumber?: { _value: string };
  };
  _lastInform?: string;
  _registered?: string;
  _tags?: string[];
  [key: string]: any;
}

export interface GenieTask {
  name: string;
  parameterNames?: string[];
  parameterValues?: [string, any, string][];
  objectName?: string;
  nextLevel?: boolean;
  fileType?: string;
  fileName?: string;
  targetFileName?: string;
}

@Injectable()
export class GenieAcsService implements OnModuleInit {
  private readonly logger = new Logger(GenieAcsService.name);
  private client: AxiosInstance;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const baseURL = this.configService.get<string>('genieacs.nbiUrl') || 'http://localhost:7557';
    const username = this.configService.get<string>('genieacs.nbiUsername');
    const password = this.configService.get<string>('genieacs.nbiPassword');

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      auth: username && password ? { username, password } : undefined,
      headers: { 'Content-Type': 'application/json' },
    });

    this.logger.log(`GenieACS NBI conectado em ${baseURL}`);
  }

  // ─── Dispositivos ─────────────────────────────────────────────────────────

  async getDevices(query: object = {}, projection?: string[]): Promise<GenieDevice[]> {
    const params: any = { query: JSON.stringify(query) };
    if (projection && projection.length > 0) {
      params.projection = projection.join(',');
    }
    const res = await this.client.get('/devices', { params });
    return res.data;
  }

  async getDevice(deviceId: string, projection?: string[]): Promise<GenieDevice | null> {
    const params: any = { query: JSON.stringify({ _id: deviceId }) };
    if (projection && projection.length > 0) {
      params.projection = projection.join(',');
    }
    const res = await this.client.get('/devices', { params });
    return res.data?.[0] || null;
  }

  async getDeviceRaw(deviceId: string): Promise<GenieDevice | null> {
    const res = await this.client.get(`/devices`, {
      params: { query: JSON.stringify({ _id: deviceId }) },
    });
    return res.data?.[0] || null;
  }

  async countDevices(query: object = {}): Promise<number> {
    const res = await this.client.get('/devices', {
      params: { query: JSON.stringify(query), limit: 1 },
      headers: { 'X-Total-Count': 'true' },
    });
    return parseInt(res.headers['x-total-count'] || '0', 10);
  }

  async deleteDevice(deviceId: string): Promise<void> {
    await this.client.delete(`/devices/${encodeURIComponent(deviceId)}`);
  }

  async addTag(deviceId: string, tag: string): Promise<void> {
    await this.client.post(`/devices/${encodeURIComponent(deviceId)}/tags/${encodeURIComponent(tag)}`);
  }

  async removeTag(deviceId: string, tag: string): Promise<void> {
    await this.client.delete(`/devices/${encodeURIComponent(deviceId)}/tags/${encodeURIComponent(tag)}`);
  }

  // ─── Tarefas (Tasks) ──────────────────────────────────────────────────────

  async createTask(deviceId: string, task: GenieTask, connectionRequest = true): Promise<any> {
    const params: any = {};
    if (connectionRequest) params.connection_request = '';
    const res = await this.client.post(
      `/devices/${encodeURIComponent(deviceId)}/tasks`,
      task,
      { params },
    );
    return res.data;
  }

  async getParameterValues(deviceId: string, parameterNames: string[]): Promise<any> {
    return this.createTask(deviceId, { name: 'getParameterValues', parameterNames });
  }

  async setParameterValues(deviceId: string, values: [string, any, string][]): Promise<any> {
    return this.createTask(deviceId, { name: 'setParameterValues', parameterValues: values });
  }

  async reboot(deviceId: string): Promise<any> {
    return this.createTask(deviceId, { name: 'reboot' });
  }

  async factoryReset(deviceId: string): Promise<any> {
    return this.createTask(deviceId, { name: 'factoryReset' });
  }

  async refreshObject(deviceId: string, objectName: string): Promise<any> {
    return this.createTask(deviceId, { name: 'refreshObject', objectName });
  }

  async addObject(deviceId: string, objectName: string): Promise<any> {
    return this.createTask(deviceId, { name: 'addObject', objectName });
  }

  async deleteObject(deviceId: string, objectName: string): Promise<any> {
    return this.createTask(deviceId, { name: 'deleteObject', objectName });
  }

  async downloadFirmware(deviceId: string, fileName: string, fileType = '1 Firmware Upgrade Image'): Promise<any> {
    return this.createTask(deviceId, { name: 'download', fileType, fileName, targetFileName: fileName });
  }

  // ─── Presets e Provisions ─────────────────────────────────────────────────

  async getPresets(): Promise<any[]> {
    const res = await this.client.get('/presets');
    return res.data;
  }

  async putPreset(name: string, preset: object): Promise<void> {
    await this.client.put(`/presets/${encodeURIComponent(name)}`, preset);
  }

  async deletePreset(name: string): Promise<void> {
    await this.client.delete(`/presets/${encodeURIComponent(name)}`);
  }

  async getProvisions(): Promise<any[]> {
    const res = await this.client.get('/provisions');
    return res.data;
  }

  async putProvision(name: string, script: string): Promise<void> {
    await this.client.put(`/provisions/${encodeURIComponent(name)}`, script, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  async deleteProvision(name: string): Promise<void> {
    await this.client.delete(`/provisions/${encodeURIComponent(name)}`);
  }

  // ─── Arquivos (Firmware) ──────────────────────────────────────────────────

  async getFiles(): Promise<any[]> {
    const res = await this.client.get('/files');
    return res.data;
  }

  async uploadFile(
    fileName: string,
    fileType: string,
    buffer: Buffer,
    mimeType = 'application/octet-stream',
  ): Promise<void> {
    await this.client.put(`/files/${encodeURIComponent(fileName)}`, buffer, {
      headers: {
        'Content-Type': mimeType,
        'fileType': fileType,
      },
    });
  }

  async deleteFile(fileName: string): Promise<void> {
    await this.client.delete(`/files/${encodeURIComponent(fileName)}`);
  }

  // ─── Diagnósticos ─────────────────────────────────────────────────────────

  async ping(deviceId: string, host: string): Promise<any> {
    // Tenta TR-098 (InternetGatewayDevice) e TR-181 (Device) em paralelo
    const tr098 = this.setParameterValues(deviceId, [
      ['InternetGatewayDevice.IPPingDiagnostics.DiagnosticsState', 'Requested', 'xsd:string'],
      ['InternetGatewayDevice.IPPingDiagnostics.Host', host, 'xsd:string'],
      ['InternetGatewayDevice.IPPingDiagnostics.NumberOfRepetitions', 4, 'xsd:unsignedInt'],
      ['InternetGatewayDevice.IPPingDiagnostics.Timeout', 1000, 'xsd:unsignedInt'],
    ]).catch(() => null);
    const tr181 = this.setParameterValues(deviceId, [
      ['Device.IP.Diagnostics.IPPing.DiagnosticsState', 'Requested', 'xsd:string'],
      ['Device.IP.Diagnostics.IPPing.Host', host, 'xsd:string'],
      ['Device.IP.Diagnostics.IPPing.NumberOfRepetitions', 4, 'xsd:unsignedInt'],
      ['Device.IP.Diagnostics.IPPing.Timeout', 1000, 'xsd:unsignedInt'],
    ]).catch(() => null);
    const [r098, r181] = await Promise.all([tr098, tr181]);
    return r098 || r181;
  }

  async traceroute(deviceId: string, host: string): Promise<any> {
    // Tenta TR-098 (InternetGatewayDevice) e TR-181 (Device) em paralelo
    const tr098 = this.setParameterValues(deviceId, [
      ['InternetGatewayDevice.TraceRouteDiagnostics.DiagnosticsState', 'Requested', 'xsd:string'],
      ['InternetGatewayDevice.TraceRouteDiagnostics.Host', host, 'xsd:string'],
      ['InternetGatewayDevice.TraceRouteDiagnostics.MaxHopCount', 30, 'xsd:unsignedInt'],
    ]).catch(() => null);
    const tr181 = this.setParameterValues(deviceId, [
      ['Device.IP.Diagnostics.TraceRoute.DiagnosticsState', 'Requested', 'xsd:string'],
      ['Device.IP.Diagnostics.TraceRoute.Host', host, 'xsd:string'],
      ['Device.IP.Diagnostics.TraceRoute.MaxHopCount', 30, 'xsd:unsignedInt'],
    ]).catch(() => null);
    const [r098, r181] = await Promise.all([tr098, tr181]);
    return r098 || r181;
  }

  // ─── Connection Request ───────────────────────────────────────────────────

  async connectionRequest(deviceId: string): Promise<void> {
    await this.client.post(`/devices/${encodeURIComponent(deviceId)}/tasks`, {
      name: 'getParameterValues',
      parameterNames: ['InternetGatewayDevice.DeviceInfo.UpTime'],
    }, { params: { connection_request: '' } });
  }

  // ─── Utilitários ──────────────────────────────────────────────────────────

  extractValue(param: any): any {
    if (!param) return null;
    if (param._value !== undefined) return param._value;
    if (param.value !== undefined) return param.value;
    return null;
  }

  extractTimestamp(param: any): Date | null {
    if (!param?._timestamp) return null;
    return new Date(param._timestamp);
  }

  isWritable(param: any): boolean {
    return param?._writable === true;
  }

  flattenDevice(device: GenieDevice): Record<string, any> {
    const result: Record<string, any> = {};
    const flatten = (obj: any, prefix = '') => {
      for (const key of Object.keys(obj || {})) {
        if (key.startsWith('_') && !['_value', '_writable', '_timestamp', '_type'].includes(key)) {
          continue;
        }
        const val = obj[key];
        const path = prefix ? `${prefix}.${key}` : key;
        if (val && typeof val === 'object' && !Array.isArray(val) && !('_value' in val)) {
          flatten(val, path);
        } else {
          result[path] = val;
        }
      }
    };
    flatten(device);
    return result;
  }
}
