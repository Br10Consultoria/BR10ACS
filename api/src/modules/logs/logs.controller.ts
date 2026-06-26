import { Controller, Get, Delete, Query, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LogsService } from './logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { LogCategory, LogLevel } from './schemas/log.schema';

@ApiTags('Logs')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar logs do sistema' })
  async query(
    @Query('deviceId') deviceId?: string,
    @Query('category') category?: LogCategory,
    @Query('level') level?: LogLevel,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: number,
    @Query('page') page?: number,
  ) {
    return this.logsService.query({
      deviceId, category, level,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit, page,
    });
  }

  @Get('device/:deviceId')
  @ApiOperation({ summary: 'Logs de um dispositivo específico' })
  async deviceLogs(@Param('deviceId') deviceId: string, @Query('limit') limit?: number) {
    return this.logsService.getDeviceLogs(deviceId, limit);
  }

  @Delete('purge')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Purgar logs mais antigos que N dias' })
  async purge(@Query('days') days: number) {
    const deleted = await this.logsService.purgeOlderThan(days || 30);
    return { deleted };
  }
}
