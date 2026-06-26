import {
  Controller, Get, Post, Param, Query, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { AlertType } from './schemas/alert.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Alertas')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('v1/alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar alertas' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'acknowledged', required: false, type: Boolean })
  @ApiQuery({ name: 'type', required: false, enum: AlertType })
  @ApiQuery({ name: 'deviceId', required: false, type: String })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('acknowledged') acknowledged?: string,
    @Query('type') type?: AlertType,
    @Query('deviceId') deviceId?: string,
  ) {
    return this.alertsService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      acknowledged: acknowledged !== undefined ? acknowledged === 'true' : undefined,
      type,
      deviceId,
    });
  }

  @Get('count/unacknowledged')
  @ApiOperation({ summary: 'Contar alertas não reconhecidos' })
  async countUnacknowledged() {
    const count = await this.alertsService.getUnacknowledgedCount();
    return { count };
  }

  @Post(':id/acknowledge')
  @ApiOperation({ summary: 'Reconhecer alerta' })
  async acknowledge(@Param('id') id: string, @CurrentUser() user: any) {
    return this.alertsService.acknowledge(id, user?.sub || 'system');
  }

  @Post('acknowledge-all')
  @ApiOperation({ summary: 'Reconhecer todos os alertas' })
  @HttpCode(HttpStatus.OK)
  async acknowledgeAll(@Body() body: { deviceId?: string }) {
    const count = await this.alertsService.acknowledgeAll(body?.deviceId);
    return { acknowledged: count };
  }
}
