import { Controller, Post, Get, Put, Body, Param, Query, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DiagnosticsService } from './diagnostics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { SettingsService } from '../settings/settings.service';

@ApiTags('Diagnósticos')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/devices/:id/diagnostics')
export class DiagnosticsController {
  constructor(
    private readonly diagnosticsService: DiagnosticsService,
    private readonly settingsService: SettingsService,
  ) {}

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

  @Post('ai-analysis')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Análise inteligente da ONT com IA (OpenAI GPT-4o-mini)' })
  async aiAnalysis(@Param('id') id: string, @Request() req) {
    return this.diagnosticsService.analyzeWithAI(id, req.user.id);
  }
}

// ── Endpoints globais de configuração de IA (sem :id) ─────────────────────────
@ApiTags('Diagnósticos')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/ai')
export class AiConfigController {
  constructor(
    private readonly diagnosticsService: DiagnosticsService,
    private readonly settingsService: SettingsService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Verificar se a IA está configurada' })
  async status() {
    return this.diagnosticsService.getAiStatus();
  }

  @Put('config')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Salvar API key da OpenAI e recarregar o cliente' })
  async saveConfig(@Body() body: { apiKey: string; baseUrl?: string }) {
    await this.settingsService.set('openai.apiKey', body.apiKey || '');
    await this.settingsService.set('openai.baseUrl', body.baseUrl || '');
    const result = await this.diagnosticsService.reloadOpenAI();
    return result;
  }

  @Get('config')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Obter configuração atual da IA (sem expor a chave completa)' })
  async getConfig() {
    const apiKey = await this.settingsService.get<string>('openai.apiKey', '');
    const baseUrl = await this.settingsService.get<string>('openai.baseUrl', '');
    return {
      hasApiKey: !!apiKey,
      apiKeyPreview: apiKey ? `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}` : null,
      baseUrl: baseUrl || null,
    };
  }
}
