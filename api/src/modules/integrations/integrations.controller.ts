import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
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

  @Get()
  @ApiOperation({ summary: 'Listar integrações' })
  async findAll() { return this.integrationsService.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar integração por ID' })
  async findById(@Param('id') id: string) { return this.integrationsService.findById(id); }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Criar integração' })
  async create(@Body() body: any) { return this.integrationsService.create(body); }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Atualizar integração' })
  async update(@Param('id') id: string, @Body() body: any) { return this.integrationsService.update(id, body); }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover integração' })
  async remove(@Param('id') id: string) { return this.integrationsService.remove(id); }

  @Post(':id/test')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Testar webhook' })
  async test(@Param('id') id: string, @Body() payload: any) {
    return this.integrationsService.testWebhook(id, payload);
  }
}
