import { Controller, Get, Post, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ApiClientsService } from './api-clients.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('Clientes de API')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('v1/api-clients')
export class ApiClientsController {
  constructor(private readonly apiClientsService: ApiClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar clientes de API' })
  async findAll() { return this.apiClientsService.findAll(); }

  @Post()
  @ApiOperation({ summary: 'Criar cliente de API (retorna a chave — salve-a!)' })
  async create(@Body() body: any) { return this.apiClientsService.create(body); }

  @Delete(':id/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revogar cliente de API' })
  async revoke(@Param('id') id: string) { return this.apiClientsService.revoke(id); }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover cliente de API' })
  async remove(@Param('id') id: string) { return this.apiClientsService.remove(id); }
}
