import { Controller, Get, Post, Res, UseGuards, Sse, MessageEvent } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SystemUpdateService } from './system-update.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as os from 'os';
import { execSync } from 'child_process';
import { Response } from 'express';

@Controller('v1/system')
@UseGuards(JwtAuthGuard)
export class SystemController {
  constructor(private readonly updateService: SystemUpdateService) {}

  @Get('metrics')
  getMetrics() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Calcular uso de CPU (média de todos os núcleos)
    let cpuUsage = 0;
    if (cpus.length > 0) {
      const totals = cpus.map((cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        return { idle: cpu.times.idle, total };
      });
      const avgIdle = totals.reduce((a, b) => a + b.idle, 0) / totals.length;
      const avgTotal = totals.reduce((a, b) => a + b.total, 0) / totals.length;
      cpuUsage = Math.round((1 - avgIdle / avgTotal) * 100);
    }

    // Load average (1, 5, 15 min)
    const loadAvg = os.loadavg();

    // Uptime do processo Node.js e do sistema operacional
    const processUptimeSec = Math.floor(process.uptime());
    const systemUptimeSec = Math.floor(os.uptime());

    // Informações de disco via df
    let diskTotal = 0;
    let diskUsed = 0;
    let diskFree = 0;
    let diskUsagePercent = 0;
    try {
      const dfOutput = execSync("df -k / 2>/dev/null | tail -1", { timeout: 3000 }).toString().trim();
      const parts = dfOutput.split(/\s+/);
      if (parts.length >= 4) {
        diskTotal = parseInt(parts[1]) * 1024;
        diskUsed  = parseInt(parts[2]) * 1024;
        diskFree  = parseInt(parts[3]) * 1024;
        diskUsagePercent = diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0;
      }
    } catch {
      // df não disponível no container — ignora silenciosamente
    }

    return {
      timestamp: new Date().toISOString(),
      cpu: {
        usage: cpuUsage,
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        loadAvg: {
          '1m': Math.round(loadAvg[0] * 100) / 100,
          '5m': Math.round(loadAvg[1] * 100) / 100,
          '15m': Math.round(loadAvg[2] * 100) / 100,
        },
      },
      memory: {
        totalBytes: totalMem,
        freeBytes: freeMem,
        usedBytes: usedMem,
        totalMB: Math.round(totalMem / 1024 / 1024),
        freeMB: Math.round(freeMem / 1024 / 1024),
        usedMB: Math.round(usedMem / 1024 / 1024),
        usagePercent: Math.round((usedMem / totalMem) * 100),
      },
      disk: {
        totalBytes: diskTotal,
        usedBytes: diskUsed,
        freeBytes: diskFree,
        totalGB: Math.round(diskTotal / 1024 / 1024 / 1024 * 10) / 10,
        usedGB:  Math.round(diskUsed  / 1024 / 1024 / 1024 * 10) / 10,
        freeGB:  Math.round(diskFree  / 1024 / 1024 / 1024 * 10) / 10,
        usagePercent: diskUsagePercent,
      },
      uptime: {
        processSec: processUptimeSec,
        systemSec: systemUptimeSec,
        processFormatted: this.formatUptime(processUptimeSec),
        systemFormatted: this.formatUptime(systemUptimeSec),
      },
      platform: {
        os: os.type(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname(),
      },
    };
  }

  // ── Atualização do Sistema ────────────────────────────────────────────────

  @Get('version')
  async getVersion() {
    return this.updateService.getVersionInfo();
  }

  @Get('update/status')
  getUpdateStatus() {
    return { updating: this.updateService.isUpdating() };
  }

  @Sse('update/stream')
  updateStream(): Observable<MessageEvent> {
    const subject = this.updateService.startUpdate();
    return subject.pipe(
      map((line) => ({
        data: JSON.stringify(line),
      } as MessageEvent)),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private formatUptime(seconds: number): string {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }
}
