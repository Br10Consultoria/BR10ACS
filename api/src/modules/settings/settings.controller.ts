import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import * as nodemailer from 'nodemailer';
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
}
