import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LicenseService } from './license.service';

@Controller('v1/license')
@UseGuards(JwtAuthGuard)
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  /**
   * GET /api/v1/license
   * Retorna informações completas da licença atual.
   */
  @Get()
  async getLicense() {
    return this.licenseService.getLicenseInfo();
  }

  /**
   * POST /api/v1/license/activate
   * Registra e valida uma nova chave de licença.
   */
  @Post('activate')
  @HttpCode(HttpStatus.OK)
  async activateLicense(@Body() body: { key: string }) {
    if (!body?.key?.trim()) {
      throw new BadRequestException('Chave de licença não informada.');
    }
    return this.licenseService.activateLicense(body.key.trim());
  }

  /**
   * POST /api/v1/license/refresh
   * Força nova verificação com o servidor de licenças.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshLicense() {
    return this.licenseService.refreshLicense();
  }

  /**
   * DELETE /api/v1/license
   * Remove a licença registrada.
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeLicense() {
    await this.licenseService.removeLicense();
  }

  /**
   * GET /api/v1/license/status
   * Retorna apenas o status atual (rápido, sem consulta ao banco).
   */
  @Get('status')
  getStatus() {
    return { status: this.licenseService.getCachedStatus() };
  }
}
