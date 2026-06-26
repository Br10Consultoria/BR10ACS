import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GenieAcsService } from '../genieacs/genieacs.service';
import { DiagnosticLog, DiagnosticLogDocument } from './schemas/diagnostic-log.schema';

export type DiagnosticType = 'ping' | 'traceroute' | 'speedtest';

@Injectable()
export class DiagnosticsService {
  private readonly logger = new Logger(DiagnosticsService.name);

  constructor(
    private genieAcsService: GenieAcsService,
    @InjectModel(DiagnosticLog.name) private diagLogModel: Model<DiagnosticLogDocument>,
  ) {}

  async startPing(deviceId: string, host: string, userId: string): Promise<DiagnosticLogDocument> {
    const log = await this.diagLogModel.create({
      deviceId,
      type: 'ping',
      host,
      status: 'running',
      startedAt: new Date(),
      startedBy: userId,
    });

    try {
      await this.genieAcsService.ping(deviceId, host);
      await this.diagLogModel.findByIdAndUpdate(log._id, { status: 'pending_result' });
          } catch (err: any) {
        await this.diagLogModel.findByIdAndUpdate(log._id, {
          status: 'error',
          error: err?.message || String(err),
          finishedAt: new Date(),
        });
      }

    return log;
  }

  async startTraceroute(deviceId: string, host: string, userId: string): Promise<DiagnosticLogDocument> {
    const log = await this.diagLogModel.create({
      deviceId,
      type: 'traceroute',
      host,
      status: 'running',
      startedAt: new Date(),
      startedBy: userId,
    });

    try {
      await this.genieAcsService.traceroute(deviceId, host);
      await this.diagLogModel.findByIdAndUpdate(log._id, { status: 'pending_result' });
          } catch (err: any) {
        await this.diagLogModel.findByIdAndUpdate(log._id, {
          status: 'error',
          error: err?.message || String(err),
          finishedAt: new Date(),
        });
      }

    return log;
  }

  async startSpeedTest(deviceId: string, downloadUrl: string, userId: string): Promise<DiagnosticLogDocument> {
    const log = await this.diagLogModel.create({
      deviceId,
      type: 'speedtest',
      host: downloadUrl,
      status: 'running',
      startedAt: new Date(),
      startedBy: userId,
    });

    try {
      await this.genieAcsService.setParameterValues(deviceId, [
        ['InternetGatewayDevice.DownloadDiagnostics.DiagnosticsState', 'Requested', 'xsd:string'],
        ['InternetGatewayDevice.DownloadDiagnostics.DownloadURL', downloadUrl, 'xsd:string'],
      ]);
      await this.diagLogModel.findByIdAndUpdate(log._id, { status: 'pending_result' });
          } catch (err: any) {
        await this.diagLogModel.findByIdAndUpdate(log._id, {
          status: 'error',
          error: err?.message || String(err),
          finishedAt: new Date(),
        });
      }

    return log;
  }

  async getPingResult(deviceId: string): Promise<any> {
    const device = await this.genieAcsService.getDevice(deviceId, [
      'InternetGatewayDevice.IPPingDiagnostics',
    ]);
    if (!device) return null;
    const diag = device?.InternetGatewayDevice?.IPPingDiagnostics;
    if (!diag) return null;
    return {
      state: diag.DiagnosticsState?._value,
      host: diag.Host?._value,
      avgTime: diag.AverageResponseTime?._value,
      minTime: diag.MinimumResponseTime?._value,
      maxTime: diag.MaximumResponseTime?._value,
      success: diag.SuccessCount?._value,
      failure: diag.FailureCount?._value,
    };
  }

  async getTracerouteResult(deviceId: string): Promise<any> {
    const device = await this.genieAcsService.getDevice(deviceId, [
      'InternetGatewayDevice.TraceRouteDiagnostics',
    ]);
    if (!device) return null;
    const diag = device?.InternetGatewayDevice?.TraceRouteDiagnostics;
    if (!diag) return null;
    return {
      state: diag.DiagnosticsState?._value,
      host: diag.Host?._value,
      hops: this.extractTracerouteHops(diag),
    };
  }

  async getSpeedTestResult(deviceId: string): Promise<any> {
    const device = await this.genieAcsService.getDevice(deviceId, [
      'InternetGatewayDevice.DownloadDiagnostics',
    ]);
    if (!device) return null;
    const diag = device?.InternetGatewayDevice?.DownloadDiagnostics;
    if (!diag) return null;
    return {
      state: diag.DiagnosticsState?._value,
      url: diag.DownloadURL?._value,
      totalBytes: diag.TotalBytesReceived?._value,
      testBytes: diag.TestBytesReceived?._value,
      startTime: diag.ROMTime?._value,
      endTime: diag.EOMTime?._value,
    };
  }

  async getHistory(deviceId: string, type?: DiagnosticType, limit = 20): Promise<DiagnosticLogDocument[]> {
    const query: any = { deviceId };
    if (type) query.type = type;
    return this.diagLogModel.find(query).sort({ startedAt: -1 }).limit(limit).exec();
  }

  private extractTracerouteHops(diag: any): any[] {
    const hops: any[] = [];
    const routeHops = diag.RouteHops;
    if (!routeHops) return hops;
    for (const idx of Object.keys(routeHops)) {
      if (isNaN(Number(idx))) continue;
      const hop = routeHops[idx];
      hops.push({
        hopIndex: Number(idx),
        host: hop.Host?._value,
        hostAddress: hop.HostAddress?._value,
        rttTimes: hop.RTTimes?._value,
      });
    }
    return hops.sort((a, b) => a.hopIndex - b.hopIndex);
  }
}
