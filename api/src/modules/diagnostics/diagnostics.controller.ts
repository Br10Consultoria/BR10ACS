import { Controller, Post, Get, Body, Param, Query, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DiagnosticsService } from './diagnostics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Diagnósticos')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/devices/:id/diagnostics')
export class DiagnosticsController {
  constructor(private readonly diagnosticsService: DiagnosticsService) {}

  @Post('ping')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Iniciar diagnóstico de ping' })
  async ping(@Param('id') id: string, @Body('host') host: string, @Request() req) {
    return this.diagnosticsService.startPing(id, host || '8.8.8.8', req.user.id);
  }

  @Get('ping/result')
  @ApiOperation({ summary: 'Obter resultado do ping' })
  async pingResult(@Param('id') id: string) {
    return this.diagnosticsService.getPingResult(id);
  }

  @Post('traceroute')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Iniciar diagnóstico de traceroute' })
  async traceroute(@Param('id') id: string, @Body('host') host: string, @Request() req) {
    return this.diagnosticsService.startTraceroute(id, host || '8.8.8.8', req.user.id);
  }

  @Get('traceroute/result')
  @ApiOperation({ summary: 'Obter resultado do traceroute' })
  async tracerouteResult(@Param('id') id: string) {
    return this.diagnosticsService.getTracerouteResult(id);
  }

  @Post('speedtest')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Iniciar teste de velocidade' })
  async speedtest(@Param('id') id: string, @Body('url') url: string, @Request() req) {
    return this.diagnosticsService.startSpeedTest(id, url, req.user.id);
  }

  @Get('speedtest/result')
  @ApiOperation({ summary: 'Obter resultado do speedtest' })
  async speedtestResult(@Param('id') id: string) {
    return this.diagnosticsService.getSpeedTestResult(id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Histórico de diagnósticos do dispositivo' })
  async history(@Param('id') id: string, @Query('type') type?: any, @Query('limit') limit?: number) {
    return this.diagnosticsService.getHistory(id, type, limit);
  }
}
