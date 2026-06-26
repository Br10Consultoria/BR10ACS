import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CollectorService } from './collector.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('Coletor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/collector')
export class CollectorController {
  constructor(private readonly collectorService: CollectorService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas do dashboard (online/offline/sinal)' })
  async getStats() {
    return this.collectorService.getDashboardStats();
  }

  @Post('collect')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Forçar coleta imediata de todos os dispositivos' })
  async forceCollect() {
    const result = await this.collectorService.collect();
    return { message: 'Coleta executada', ...result };
  }

  @Get('devices/:deviceId/history')
  @ApiOperation({ summary: 'Histórico de TimeSeries de um dispositivo' })
  @ApiQuery({ name: 'hours', required: false, description: 'Horas de histórico (padrão: 24)' })
  async getDeviceHistory(
    @Param('deviceId') deviceId: string,
    @Query('hours') hours?: string,
  ) {
    const h = hours ? parseInt(hours, 10) : 24;
    const data = await this.collectorService.getDeviceHistory(deviceId, h);
    return { deviceId, hours: h, count: data.length, data };
  }
}
