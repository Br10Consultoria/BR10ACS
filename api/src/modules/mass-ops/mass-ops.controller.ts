import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MassOpsService } from './mass-ops.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('Operações em Massa')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/mass-ops')
export class MassOpsController {
  constructor(private readonly massOpsService: MassOpsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar operações em massa' })
  async findAll() { return this.massOpsService.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Status de uma operação em massa' })
  async findById(@Param('id') id: string) { return this.massOpsService.findById(id); }

  @Post()
  @Roles(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Criar e iniciar operação em massa' })
  async create(@Body() body: any, @Request() req) {
    return this.massOpsService.create(body, req.user.id);
  }

  @Delete(':id/cancel')
  @Roles(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancelar operação em massa' })
  async cancel(@Param('id') id: string) { return this.massOpsService.cancel(id); }
}
