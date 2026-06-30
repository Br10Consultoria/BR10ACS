import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('WhatsApp')
@Controller('v1/whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(private readonly whatsAppService: WhatsAppService) {}

  // ── Webhook (público — chamado pela Meta) ──────────────────────────────────

  /**
   * GET /api/v1/whatsapp/webhook
   * Verificação do webhook pela Meta (handshake inicial).
   * A Meta envia hub.mode=subscribe, hub.verify_token e hub.challenge.
   */
  @Public()
  @Get('webhook')
  @ApiOperation({
    summary: 'Verificação do webhook WhatsApp (Meta handshake)',
    description:
      'Endpoint público chamado pela Meta para verificar o webhook. ' +
      'Retorna hub.challenge se o hub.verify_token corresponder ao configurado.',
  })
  @ApiQuery({ name: 'hub.mode', required: false })
  @ApiQuery({ name: 'hub.verify_token', required: false })
  @ApiQuery({ name: 'hub.challenge', required: false })
  async verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.whatsAppService.verifyWebhook(mode, token, challenge);
    if (result !== null) {
      res.status(200).send(result);
    } else {
      res.status(403).send('Forbidden');
    }
  }

  /**
   * POST /api/v1/whatsapp/webhook
   * Recebe mensagens e eventos do WhatsApp enviados pela Meta.
   */
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receber mensagens WhatsApp (webhook Meta)',
    description:
      'Endpoint público que recebe os payloads de mensagens enviados pela Meta. ' +
      'Processa mensagens de texto e respostas de botões interativos.',
  })
  async receiveWebhook(@Body() payload: any): Promise<{ status: string }> {
    // Responde 200 imediatamente (requisito da Meta) e processa em background
    this.whatsAppService.handleWebhook(payload).catch(err =>
      this.logger.error(`Erro no handleWebhook: ${err.message}`),
    );
    return { status: 'ok' };
  }

  // ── Configuração (autenticado) ─────────────────────────────────────────────

  /**
   * GET /api/v1/whatsapp/config
   * Retorna a configuração atual do WhatsApp (sem o accessToken por segurança).
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @Get('config')
  @ApiOperation({
    summary: 'Obter configuração do WhatsApp',
    description: 'Retorna as configurações do WhatsApp Business (Phone Number ID, verify token, status). O Access Token não é retornado por segurança.',
  })
  async getConfig(): Promise<any> {
    const config = await this.whatsAppService.getConfig();
    return {
      enabled: config.enabled,
      phoneNumberId: config.phoneNumberId,
      verifyToken: config.verifyToken,
      welcomeMessage: config.welcomeMessage,
      businessName: config.businessName,
      hasAccessToken: !!config.accessToken,
    };
  }

  /**
   * PUT /api/v1/whatsapp/config
   * Salva a configuração do WhatsApp.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @Put('config')
  @ApiOperation({
    summary: 'Salvar configuração do WhatsApp',
    description:
      'Salva as credenciais e configurações do WhatsApp Business Cloud API. ' +
      'Campos: enabled, phoneNumberId, accessToken, verifyToken, welcomeMessage, businessName.',
  })
  async saveConfig(@Body() body: any): Promise<{ success: boolean }> {
    await this.whatsAppService.saveConfig(body);
    return { success: true };
  }

  // ── Status e informações ───────────────────────────────────────────────────

  /**
   * GET /api/v1/whatsapp/info
   * Consulta informações do número de telefone na API da Meta.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @Get('info')
  @ApiOperation({
    summary: 'Consultar informações do número WhatsApp na Meta',
    description: 'Faz uma requisição à Graph API da Meta para verificar se o Phone Number ID e o Access Token estão corretos.',
  })
  async getWebhookInfo(): Promise<any> {
    return this.whatsAppService.getWebhookInfo();
  }

  /**
   * GET /api/v1/whatsapp/stats
   * Retorna estatísticas de sessões ativas.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @Get('stats')
  @ApiOperation({
    summary: 'Estatísticas de sessões WhatsApp',
    description: 'Retorna o total de sessões e sessões ativas no momento.',
  })
  async getStats(): Promise<any> {
    return this.whatsAppService.getStats();
  }

  /**
   * POST /api/v1/whatsapp/test-message
   * Envia uma mensagem de teste para um número.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @Post('test-message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enviar mensagem de teste',
    description: 'Envia uma mensagem de texto simples para um número de telefone para validar a configuração.',
  })
  async sendTestMessage(
    @Body() body: { phone: string; message?: string },
  ): Promise<{ success: boolean }> {
    const msg = body.message || '✅ Teste de integração WhatsApp BR10ACS — funcionando!';
    await this.whatsAppService.sendText(body.phone, msg);
    return { success: true };
  }
}
