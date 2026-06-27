import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { GenieAcsService } from '../genieacs/genieacs.service';
import { DiagnosticLog, DiagnosticLogDocument } from './schemas/diagnostic-log.schema';
import { TimeSeries, TimeSeriesDocument } from '../devices/schemas/timeseries.schema';
import { DevicesService } from '../devices/devices.service';
import { LogsService } from '../logs/logs.service';
import { SettingsService } from '../settings/settings.service';

export type DiagnosticType = 'ping' | 'traceroute' | 'speedtest';

export interface AiAnalysisResult {
  summary: string
  severity: 'ok' | 'warning' | 'critical'
  issues: { title: string; description: string; severity: 'ok' | 'warning' | 'critical' }[]
  recommendations: { priority: 'high' | 'medium' | 'low'; action: string; reason: string }[]
  predictedCause?: string
  estimatedImpact?: string
}

@Injectable()
export class DiagnosticsService {
  private readonly logger = new Logger(DiagnosticsService.name);
  private openai: OpenAI | null = null;

  constructor(
    private genieAcsService: GenieAcsService,
    private configService: ConfigService,
    private logsService: LogsService,
    private settingsService: SettingsService,
    @Inject(forwardRef(() => DevicesService)) private devicesService: DevicesService,
    @InjectModel(DiagnosticLog.name) private diagLogModel: Model<DiagnosticLogDocument>,
    @InjectModel(TimeSeries.name) private timeSeriesModel: Model<TimeSeriesDocument>,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const baseURL = this.configService.get<string>('OPENAI_API_BASE');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
    }
  }

  /** Recarrega o cliente OpenAI usando a chave armazenada no banco (Settings). */
  async reloadOpenAI(): Promise<{ configured: boolean }> {
    const apiKey = await this.settingsService.get<string>('openai.apiKey', '');
    const baseUrl = await this.settingsService.get<string>('openai.baseUrl', '');
    const envKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    const envBase = this.configService.get<string>('OPENAI_API_BASE') || '';
    const key = apiKey || envKey;
    const base = baseUrl || envBase;
    if (key) {
      this.openai = new OpenAI({ apiKey: key, ...(base ? { baseURL: base } : {}) });
      this.logger.log('OpenAI client recarregado com chave do banco');
      return { configured: true };
    }
    this.openai = null;
    return { configured: false };
  }

  /** Retorna se a IA está configurada (sem expor a chave). */
  async getAiStatus(): Promise<{ configured: boolean; source: string }> {
    const dbKey = await this.settingsService.get<string>('openai.apiKey', '');
    const envKey = this.configService.get<string>('OPENAI_API_KEY') || '';
    if (dbKey) return { configured: true, source: 'database' };
    if (envKey) return { configured: true, source: 'env' };
    return { configured: false, source: 'none' };
  }

  // ── Diagnósticos TR-069 ────────────────────────────────────────────────────

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
      'Device.IP.Diagnostics.IPPing',
    ]);
    if (!device) return null;
    // Tenta TR-098 primeiro, depois TR-181
    const diag098 = device?.InternetGatewayDevice?.IPPingDiagnostics;
    const diag181 = device?.Device?.IP?.Diagnostics?.IPPing;
    const diag = diag098 || diag181;
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
      'Device.IP.Diagnostics.TraceRoute',
    ]);
    if (!device) return null;
    // Tenta TR-098 primeiro, depois TR-181
    const diag098 = device?.InternetGatewayDevice?.TraceRouteDiagnostics;
    const diag181 = device?.Device?.IP?.Diagnostics?.TraceRoute;
    const diag = diag098 || diag181;
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

  // ── Análise com IA ─────────────────────────────────────────────────────────

  async analyzeWithAI(deviceId: string, userId: string): Promise<AiAnalysisResult> {
    if (!this.openai) {
      return {
        severity: 'warning',
        summary: 'IA não configurada. Defina OPENAI_API_KEY no arquivo .env para ativar o diagnóstico inteligente.',
        issues: [],
        recommendations: [
          {
            priority: 'high',
            action: 'Configurar OPENAI_API_KEY no .env',
            reason: 'A análise por IA requer uma chave de API da OpenAI.',
          },
        ],
      };
    }

    // Coleta dados do dispositivo
    const [device, timeSeries, recentLogs] = await Promise.allSettled([
      this.devicesService.getById(deviceId),
      this.timeSeriesModel
        .find({ deviceId })
        .sort({ timestamp: -1 })
        .limit(48)
        .lean()
        .exec(),
      this.logsService.getDeviceLogs(deviceId, 20),
    ]);

    const dev = device.status === 'fulfilled' ? device.value : null;
    const ts = timeSeries.status === 'fulfilled' ? timeSeries.value : [];
    const logs = recentLogs.status === 'fulfilled' ? recentLogs.value : [];

    // Calcula estatísticas do sinal
    const rxValues = ts.filter(t => t.rxDbm != null).map(t => t.rxDbm as number);
    const avgRx = rxValues.length ? rxValues.reduce((a, b) => a + b, 0) / rxValues.length : null;
    const minRx = rxValues.length ? Math.min(...rxValues) : null;
    const maxRx = rxValues.length ? Math.max(...rxValues) : null;
    const offlineCount = ts.filter(t => !t.online).length;
    const offlinePct = ts.length ? Math.round((offlineCount / ts.length) * 100) : 0;

    // Monta contexto para a IA
    const context = {
      device: dev ? {
        serialNumber: dev.serialNumber,
        manufacturer: dev.manufacturer,
        model: dev.model,
        firmware: dev.softwareVersion,
        online: dev.online,
        uptime: dev.uptime,
        lastInform: dev.lastInform,
        rxPower: dev.rxPower,
        txPower: dev.txPower,
        temperature: dev.temperature,
        pppLogin: dev.pppLogin,
        ipv4: dev.ipv4,
      } : null,
      signal: {
        current: dev?.rxPower ?? null,
        average24h: avgRx ? Number(avgRx.toFixed(2)) : null,
        min24h: minRx,
        max24h: maxRx,
        offlinePercent24h: offlinePct,
        dataPoints: ts.length,
      },
      recentEvents: logs.slice(0, 10).map((l: any) => ({
        action: l.message || l.action,
        level: l.level,
        time: l.date,
      })),
    };

    const systemPrompt = `Você é um especialista em redes GPON e TR-069 de uma ISP brasileira.
Analise os dados de uma ONT (Optical Network Terminal) e forneça um diagnóstico técnico detalhado.

Regras de sinal óptico GPON:
- RX entre -8 e -27 dBm: normal
- RX entre -27 e -30 dBm: sinal fraco (atenção)
- RX abaixo de -30 dBm: sinal crítico (risco de queda)
- RX acima de -8 dBm: sinal muito alto (risco de saturação)
- Variação > 3 dBm em 24h: instabilidade óptica

Responda SOMENTE com JSON válido no seguinte formato:
{
  "summary": "Resumo executivo em 1-2 frases",
  "severity": "ok|warning|critical",
  "issues": [
    { "title": "Nome do problema", "description": "Descrição técnica", "severity": "ok|warning|critical" }
  ],
  "recommendations": [
    { "priority": "high|medium|low", "action": "Ação recomendada", "reason": "Justificativa técnica" }
  ],
  "predictedCause": "Causa mais provável do problema (se houver)",
  "estimatedImpact": "Impacto estimado no cliente"
}`;

    const userPrompt = `Analise esta ONT:\n${JSON.stringify(context, null, 2)}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const result = JSON.parse(content) as AiAnalysisResult;

      // Loga a análise
      await this.logsService.info(
        `Análise IA executada para ${deviceId}`,
        'device' as any,
        { severity: result.severity, issuesCount: result.issues?.length },
        deviceId,
        userId,
      ).catch(() => {});

      return result;
    } catch (err: any) {
      this.logger.error(`Erro na análise IA para ${deviceId}: ${err.message}`);
      throw new Error(`Falha na análise IA: ${err.message}`);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

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
