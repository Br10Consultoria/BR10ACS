import {
  Controller, Get, Put, Delete, Post, Body, Param,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PresetsService } from './presets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Presets & Provisões')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/presets')
export class PresetsController {
  constructor(private readonly presetsService: PresetsService) {}

  // ── Presets ──────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar todos os presets do GenieACS' })
  async listPresets() {
    return this.presetsService.listPresets();
  }

  @Put(':name')
  @ApiOperation({ summary: 'Criar ou atualizar um preset' })
  async putPreset(@Param('name') name: string, @Body() body: Record<string, unknown>) {
    return this.presetsService.putPreset(name, body);
  }

  @Delete(':name')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover um preset' })
  async deletePreset(@Param('name') name: string) {
    return this.presetsService.deletePreset(name);
  }

  // ── Templates de coleta automática ───────────────────────────────────────────

  @Post('apply-template')
  @ApiOperation({ summary: 'Criar provisão + preset de coleta para um OUI/modelo' })
  async applyTemplate(@Body() body: { oui: string; productClass?: string }) {
    return this.presetsService.applyTemplate(body.oui, body.productClass);
  }

  // ── Provisions ───────────────────────────────────────────────────────────────

  @Get('provisions')
  @ApiOperation({ summary: 'Listar todos os scripts de provisão' })
  async listProvisions() {
    return this.presetsService.listProvisions();
  }

  @Put('provisions/:name')
  @ApiOperation({ summary: 'Criar ou atualizar um script de provisão' })
  async putProvision(@Param('name') name: string, @Body('script') script: string) {
    return this.presetsService.putProvision(name, script || '');
  }

  @Delete('provisions/:name')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover um script de provisão' })
  async deleteProvision(@Param('name') name: string) {
    return this.presetsService.deleteProvision(name);
  }
}
