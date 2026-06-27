import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('Integrações')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar integrações' })
  async findAll() {
    return this.integrationsService.findAll();
  }

  @Get('adapters')
  @ApiOperation({ summary: 'Listar adaptadores ERP disponíveis' })
  async getAdapters() {
    return this.integrationsService.getAdapters();
  }

  @Get('adapters/:type')
  @ApiOperation({ summary: 'Obter configuração padrão de um adaptador ERP' })
  async getAdapterDefaults(@Param('type') type: string) {
    return this.integrationsService.getAdapterDefaults(type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar integração por ID' })
  async findById(@Param('id') id: string) {
    return this.integrationsService.findById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Criar integração' })
  async create(@Body() body: Record<string, unknown>) {
    return this.integrationsService.create(body);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Atualizar integração' })
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.integrationsService.update(id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover integração' })
  async remove(@Param('id') id: string) {
    return this.integrationsService.remove(id);
  }

  // ── Lookup de cliente no ERP ──────────────────────────────────────────────

  @Get(':id/lookup')
  @ApiOperation({ summary: 'Buscar cliente no ERP por PPPoE, serial ou CPF' })
  @ApiQuery({ name: 'pppoe', required: false })
  @ApiQuery({ name: 'serial', required: false })
  @ApiQuery({ name: 'cpf', required: false })
  async lookupCustomer(
    @Param('id') id: string,
    @Query('pppoe') pppoe?: string,
    @Query('serial') serial?: string,
    @Query('cpf') cpf?: string,
  ) {
    return this.integrationsService.lookupCustomer(id, { pppoe, serial, cpf });
  }

  // ── Toggle enable/disable ──────────────────────────────────────────────────────

  @Put(':id/toggle')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Ativar ou desativar integração' })
  async toggle(@Param('id') id: string, @Body() body: { enabled: boolean }) {
    return this.integrationsService.update(id, { enabled: body.enabled });
  }

  // ── Webhook (compatibilidade) ──────────────────────────────────────────────────────

  @Post(':id/test-connection')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Testar conexão com o ERP' })
  async testConnection(@Param('id') id: string) {
    return this.integrationsService.testConnection(id);
  }

  // ── Webhook (compatibilidade) ─────────────────────────────────────────────

  @Post(':id/test')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Testar webhook' })
  async test(@Param('id') id: string, @Body() payload: unknown) {
    return this.integrationsService.testWebhook(id, payload);
  }
}
