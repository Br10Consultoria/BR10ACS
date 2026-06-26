import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@ApiTags('Configurações')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas as configurações' })
  async getAll() { return this.settingsService.getAll(); }

  @Get('public')
  @ApiOperation({ summary: 'Configurações públicas (sem segredos)' })
  async getPublic() { return this.settingsService.getPublicSettings(); }

  @Put()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Salvar múltiplas configurações' })
  async setBulk(@Body() body: { settings: { key: string; value: any }[] }) {
    await this.settingsService.setBulk(body.settings);
    return { success: true };
  }
}
