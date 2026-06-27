import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { IxcService } from './ixc.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('Integrações')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly ixcService: IxcService,
  ) {}

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

  // ── Toggle enable/disable ─────────────────────────────────────────────────

  @Put(':id/toggle')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Ativar ou desativar integração' })
  async toggle(@Param('id') id: string, @Body() body: { enabled: boolean }) {
    return this.integrationsService.update(id, { enabled: body.enabled });
  }

  // ── Ações ERP ─────────────────────────────────────────────────────────────

  @Get(':id/actions')
  @ApiOperation({ summary: 'Listar ações disponíveis para a integração' })
  async listActions(@Param('id') id: string) {
    return this.integrationsService.listActions(id);
  }

  @Post(':id/actions/:action')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Executar ação no ERP (suspend, reactivate, open_ticket)' })
  async executeAction(
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() body: { customerId: string; extra?: Record<string, unknown> },
  ) {
    return this.integrationsService.executeAction(id, action, body.customerId, body.extra);
  }

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

  // ── IXC Avançado: radusuarios ─────────────────────────────────────────────

  @Get(':id/ixc/rad-user')
  @ApiOperation({ summary: 'IXC: Buscar usuário RADIUS por login, MAC ou MAC da ONT' })
  @ApiQuery({ name: 'login', required: false, description: 'Login PPPoE do usuário' })
  @ApiQuery({ name: 'mac', required: false, description: 'MAC do equipamento' })
  @ApiQuery({ name: 'onuMac', required: false, description: 'MAC da ONT' })
  async ixcLookupRadUser(
    @Param('id') id: string,
    @Query('login') login?: string,
    @Query('mac') mac?: string,
    @Query('onuMac') onuMac?: string,
  ) {
    return this.ixcService.lookupRadUser(id, { login, mac, onuMac });
  }

  @Get(':id/ixc/ont-fibra')
  @ApiOperation({ summary: 'IXC: Buscar ONT fibra por MAC, número da ONT, ID de contrato ou ID de login' })
  @ApiQuery({ name: 'mac', required: false })
  @ApiQuery({ name: 'onuNumero', required: false })
  @ApiQuery({ name: 'idContrato', required: false })
  @ApiQuery({ name: 'idLogin', required: false })
  async ixcLookupOntFibra(
    @Param('id') id: string,
    @Query('mac') mac?: string,
    @Query('onuNumero') onuNumero?: string,
    @Query('idContrato') idContrato?: string,
    @Query('idLogin') idLogin?: string,
  ) {
    return this.ixcService.lookupOntFibra(id, { mac, onuNumero, idContrato, idLogin });
  }

  @Get(':id/ixc/ont-complete')
  @ApiOperation({ summary: 'IXC: Busca completa da ONT (radusuarios + radpop_radio_cliente_fibra)' })
  @ApiQuery({ name: 'login', required: false })
  @ApiQuery({ name: 'mac', required: false })
  @ApiQuery({ name: 'serial', required: false })
  async ixcLookupOntComplete(
    @Param('id') id: string,
    @Query('login') login?: string,
    @Query('mac') mac?: string,
    @Query('serial') serial?: string,
  ) {
    return this.ixcService.lookupOntComplete(id, { login, mac, serial });
  }

  @Get(':id/ixc/onts-by-contract')
  @ApiOperation({ summary: 'IXC: Listar todas as ONTs fibra de um contrato' })
  @ApiQuery({ name: 'idContrato', required: true })
  async ixcListOntsByContract(
    @Param('id') id: string,
    @Query('idContrato') idContrato: string,
  ) {
    return this.ixcService.listOntsByContract(id, idContrato);
  }

  @Put(':id/ixc/ont-signal/:ontId')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'IXC: Atualizar dados de sinal de uma ONT fibra' })
  async ixcUpdateOntSignal(
    @Param('id') id: string,
    @Param('ontId') ontId: string,
    @Body() body: { sinal_rx?: string; sinal_tx?: string; temperatura?: string; voltagem?: string; data_sinal?: string },
  ) {
    return this.ixcService.updateOntSignal(id, ontId, body);
  }

  // ── Import de coleção de API ──────────────────────────────────────────────

  @Post('parse-collection')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Analisar coleção de API (Node.js) e extrair endpoints para configuração automática' })
  async parseApiCollection(@Body() body: { content: string }) {
    return this.ixcService.parseApiCollection(body.content);
  }
}
