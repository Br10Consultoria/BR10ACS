import {
  Controller, Post, Get, Body, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { TelegramBotService } from './telegram-bot.service';

@Controller('v1/telegram')
export class TelegramBotController {
  constructor(private readonly botService: TelegramBotService) {}

  /**
   * Endpoint público para receber updates do Telegram via webhook.
   * NÃO requer autenticação JWT — o Telegram envia para este endpoint.
   */
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() update: any): Promise<{ ok: boolean }> {
    // Processa de forma assíncrona para responder rapidamente ao Telegram
    setImmediate(() => this.botService.handleUpdate(update));
    return { ok: true };
  }

  /**
   * Registra o webhook do bot no Telegram com a URL pública do sistema.
   * Requer autenticação JWT.
   */
  @UseGuards(JwtAuthGuard)
  @Post('register-webhook')
  async registerWebhook(@Body() body: { publicUrl: string }) {
    if (!body.publicUrl) {
      return { ok: false, description: 'publicUrl é obrigatório' };
    }
    return this.botService.registerWebhook(body.publicUrl);
  }

  /**
   * Remove o webhook do bot no Telegram.
   * Requer autenticação JWT.
   */
  @UseGuards(JwtAuthGuard)
  @Post('delete-webhook')
  async deleteWebhook() {
    return this.botService.deleteWebhook();
  }

  /**
   * Retorna informações do webhook atual.
   * Requer autenticação JWT.
   */
  @UseGuards(JwtAuthGuard)
  @Get('webhook-info')
  async getWebhookInfo() {
    return this.botService.getWebhookInfo();
  }
}
