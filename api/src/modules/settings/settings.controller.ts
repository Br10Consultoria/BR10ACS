import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import * as nodemailer from 'nodemailer';
import axios from 'axios';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('Configurações')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas as configurações' })
  async getAll() { return this.settingsService.getAll(); }

  @Get('public')
  @ApiOperation({ summary: 'Configurações públicas (sem segredos)' })
  async getPublic() { return this.settingsService.getPublicSettings(); }

  @Put()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Salvar múltiplas configurações' })
  async setBulk(@Body() body: { settings: { key: string; value: any }[] }) {
    await this.settingsService.setBulk(body.settings);
    return { success: true };
  }

  // ── Teste SMTP ────────────────────────────────────────────────────────────

  @Post('test-smtp')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Testar configuração SMTP enviando um e-mail de teste' })
  async testSmtp() {
    const host   = await this.settingsService.get<string>('notifications.smtp.host');
    const port   = await this.settingsService.get<number>('notifications.smtp.port', 587);
    const secure = await this.settingsService.get<boolean>('notifications.smtp.secure', false);
    const user   = await this.settingsService.get<string>('notifications.smtp.user');
    const pass   = await this.settingsService.get<string>('notifications.smtp.pass');
    const from   = await this.settingsService.get<string>('notifications.smtp.from') || user;
    const to     = await this.settingsService.get<string>('notifications.smtp.to');

    if (!host || !user || !pass || !to) {
      return { ok: false, error: 'Configuração SMTP incompleta. Preencha host, usuário, senha e destinatário.' };
    }

    try {
      const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
      await transporter.sendMail({
        from,
        to,
        subject: '✅ BR10ACS — Teste de Configuração SMTP',
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto">
            <div style="background:#1e293b;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
              <h2 style="margin:0;font-size:18px">BR10ACS — Teste de E-mail</h2>
            </div>
            <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
              <p style="color:#0f172a">Parabéns! Sua configuração SMTP está funcionando corretamente.</p>
              <p style="color:#64748b;font-size:14px">Este é um e-mail de teste enviado pelo sistema BR10ACS em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.</p>
              <p style="color:#64748b;font-size:14px">A partir de agora, você receberá alertas de dispositivos offline, sinal crítico e outros eventos importantes neste endereço.</p>
            </div>
          </div>`,
      });
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Erro desconhecido ao enviar e-mail de teste' };
    }
  }

  // ── Teste Telegram ────────────────────────────────────────────────────────

  @Post('test-telegram')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Testar configuração do Telegram enviando uma mensagem de teste' })
  async testTelegram() {
    const botToken = await this.settingsService.get<string>('notifications.telegram.botToken');
    const chatId   = await this.settingsService.get<string>('notifications.telegram.chatId');

    if (!botToken || !chatId) {
      return { ok: false, error: 'Configuração do Telegram incompleta. Preencha o Bot Token e o Chat ID.' };
    }

    const text = `✅ *BR10ACS — Teste de Conexão*\n\nSua integração com o Telegram está funcionando corretamente!\n\n_Enviado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}_`;

    try {
      const start = Date.now();
      const res = await axios.post(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        { chat_id: chatId, text, parse_mode: 'Markdown' },
        { timeout: 8000 },
      );
      const latencyMs = Date.now() - start;
      if (res.data?.ok) {
        return { ok: true, latencyMs, message: `Mensagem enviada com sucesso para o chat ${chatId}` };
      }
      return { ok: false, error: `Telegram retornou: ${JSON.stringify(res.data)}` };
    } catch (err: any) {
      const detail = err?.response?.data?.description || err?.message || 'Erro desconhecido';
      return { ok: false, error: detail };
    }
  }

  // ── Teste Webhook ─────────────────────────────────────────────────────────

  @Post('test-webhook')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Testar configuração do Webhook enviando um payload de teste' })
  async testWebhook() {
    const webhookUrl = await this.settingsService.get<string>('notifications.webhook.url');
    const secret     = await this.settingsService.get<string>('notifications.webhook.secret');

    if (!webhookUrl) {
      return { ok: false, error: 'URL do webhook não configurada.' };
    }

    const payload = {
      event: 'test',
      severity: 'info',
      message: 'BR10ACS — Teste de Webhook',
      timestamp: new Date().toISOString(),
      source: 'BR10ACS',
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (secret) headers['X-BR10ACS-Secret'] = secret;

    try {
      const start = Date.now();
      const res = await axios.post(webhookUrl, payload, { headers, timeout: 8000, validateStatus: () => true });
      const latencyMs = Date.now() - start;
      const ok = res.status >= 200 && res.status < 300;
      return {
        ok,
        statusCode: res.status,
        latencyMs,
        message: ok
          ? `Webhook respondeu com status ${res.status} em ${latencyMs}ms`
          : `Webhook retornou status ${res.status}`,
        responseBody: typeof res.data === 'object' ? res.data : String(res.data).slice(0, 200),
      };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Erro ao conectar ao webhook' };
    }
  }
}
