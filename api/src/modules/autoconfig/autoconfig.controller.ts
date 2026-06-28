import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AutoConfigService } from './autoconfig.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('AutoConfig')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/autoconfig')
export class AutoConfigController {
  constructor(private readonly autoConfigService: AutoConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Listar configurações automáticas' })
  async findAll() { return this.autoConfigService.findAll(); }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas globais de autoconfig' })
  async getStats() { return this.autoConfigService.getStats(); }

  @Get('dry-run/:deviceId')
  @ApiOperation({ summary: 'Simular quais regras seriam aplicadas a um dispositivo (sem executar)' })
  async dryRun(@Param('deviceId') deviceId: string) {
    return this.autoConfigService.dryRun(deviceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar AutoConfig por ID' })
  async findById(@Param('id') id: string) { return this.autoConfigService.findById(id); }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ 
    summary: 'Criar AutoConfig',
    description: 'Cria uma nova regra de provisionamento automático. Suporta `conditions.tr069Event` (ex: BOOTSTRAP) e variáveis dinâmicas (`${ixc.pppoe_login}`, `${ixc.pppoe_password}`, `${ixc.wifi_ssid}`, `${ixc.wifi_password}`) nos valores dos parâmetros para reconfiguração automática pós-reset.'
  })
  async create(@Body() body: any) { return this.autoConfigService.create(body); }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Atualizar AutoConfig' })
  async update(@Param('id') id: string, @Body() body: any) { return this.autoConfigService.update(id, body); }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover AutoConfig' })
  async remove(@Param('id') id: string) { return this.autoConfigService.remove(id); }

  @Post('apply-all')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Forçar execução imediata em todos os dispositivos' })
  async applyAll() { return this.autoConfigService.applyAll(); }

  @Post('apply-auto-tags')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aplicar tags automáticas (fabricante, modelo, firmware) em todos os dispositivos' })
  async applyAutoTags() { return this.autoConfigService.applyAutoTags(); }

  @Post('apply/:deviceId')
  @Roles(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Aplicar AutoConfig a um dispositivo específico',
    description: 'Avalia e aplica regras de autoconfig no dispositivo. Pode ser disparado automaticamente via webhook do GenieACS no evento BOOTSTRAP.'
  })
  async applyToDevice(@Param('deviceId') deviceId: string) {
    return this.autoConfigService.applyToDevice(deviceId);
  }
}
