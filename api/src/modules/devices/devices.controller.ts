import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('Dispositivos')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar dispositivos com paginação e filtros' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'online', required: false, type: Boolean })
  @ApiQuery({ name: 'manufacturer', required: false })
  @ApiQuery({ name: 'model', required: false })
  @ApiQuery({ name: 'tag', required: false })
  async list(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('online') online?: boolean,
    @Query('manufacturer') manufacturer?: string,
    @Query('model') model?: string,
    @Query('tag') tag?: string,
  ) {
    return this.devicesService.list({ page, limit, search, online, manufacturer, model, tag });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas gerais dos dispositivos' })
  async getStats() {
    return this.devicesService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes completos de um dispositivo' })
  async getById(@Param('id') id: string) {
    return this.devicesService.getById(id);
  }

  @Get(':id/raw-params')
  @ApiOperation({ summary: 'Parâmetros TR-069 brutos do dispositivo' })
  async getRawParams(@Param('id') id: string) {
    return this.devicesService.getRawParams(id);
  }

  @Get(':id/timeseries')
  @ApiOperation({ summary: 'Histórico de telemetria do dispositivo' })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTimeSeries(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: number,
  ) {
    const device = await this.devicesService.getById(id);
    // O collector grava deviceId como normalized.id (o _id completo do GenieACS)
    // Tenta primeiro com device.id; se não houver resultados, tenta com serialNumber
    const results = await this.devicesService.getTimeSeries(
      device.id,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      limit,
    );
    if (results.length > 0) return results;
    return this.devicesService.getTimeSeries(
      device.serialNumber,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      limit,
    );
  }

  @Post(':id/reboot')
  @Roles(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Reiniciar dispositivo via TR-069' })
  async reboot(@Param('id') id: string) {
    return this.devicesService.reboot(id);
  }

  @Post(':id/factory-reset')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Restaurar configurações de fábrica' })
  async factoryReset(@Param('id') id: string) {
    return this.devicesService.factoryReset(id);
  }

  @Post(':id/connection-request')
  @Roles(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Enviar Connection Request ao dispositivo' })
  async connectionRequest(@Param('id') id: string) {
    return this.devicesService.connectionRequest(id);
  }

  @Post(':id/refresh')
  @Roles(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Forçar coleta imediata de todos os parâmetros via refreshObject' })
  async refresh(@Param('id') id: string) {
    return this.devicesService.refresh(id);
  }

  @Post(':id/parameters')
  @Roles(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Definir parâmetros TR-069 no dispositivo' })
  async setParameters(
    @Param('id') id: string,
    @Body() body: { params: { name: string; value: any; type: string }[] },
  ) {
    return this.devicesService.setParameters(id, body.params);
  }

  @Post(':id/tags/:tag')
  @Roles(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Adicionar tag ao dispositivo' })
  async addTag(@Param('id') id: string, @Param('tag') tag: string) {
    return this.devicesService.addTag(id, tag);
  }

  @Delete(':id/tags/:tag')
  @Roles(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover tag do dispositivo' })
  async removeTag(@Param('id') id: string, @Param('tag') tag: string) {
    return this.devicesService.removeTag(id, tag);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover dispositivo do ACS' })
  async delete(@Param('id') id: string) {
    return this.devicesService.delete(id);
  }

  @Get('export/excel')
  @ApiOperation({ summary: 'Exportar dispositivos para Excel (.xlsx)' })
  async exportExcel(
    @Query('manufacturer') manufacturer?: string,
    @Query('model') model?: string,
    @Query('online') online?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const buf = await this.devicesService.exportToExcel({
      manufacturer,
      model,
      online: online === 'true' ? true : online === 'false' ? false : undefined,
    });
    res!.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="dispositivos_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    });
    return new StreamableFile(buf);
  }

  @Get('export/pdf')
  @ApiOperation({ summary: 'Exportar dispositivos para PDF' })
  async exportPdf(
    @Query('manufacturer') manufacturer?: string,
    @Query('model') model?: string,
    @Query('online') online?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const buf = await this.devicesService.exportToPdf({
      manufacturer,
      model,
      online: online === 'true' ? true : online === 'false' ? false : undefined,
    });
    res!.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="dispositivos_${new Date().toISOString().slice(0, 10)}.pdf"`,
    });
    return new StreamableFile(buf);
  }
}
