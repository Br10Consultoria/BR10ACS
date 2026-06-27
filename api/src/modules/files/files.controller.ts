import {
  Controller, Get, Post, Delete, Patch, Param, Query, Body,
  UseGuards, UseInterceptors, UploadedFile,
  HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@ApiTags('Arquivos')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos os arquivos no GenieACS' })
  async listFiles() {
    return this.filesService.listFiles();
  }

  @Post('upload')
  @ApiOperation({ summary: 'Fazer upload de arquivo para o GenieACS com metadados' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    @Query('fileType') fileType = '1 Firmware Upgrade Image',
    @Query('vendor') vendor?: string,
    @Query('equipType') equipType?: string,
    @Query('model') model?: string,
    @Query('version') version?: string,
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado');
    await this.filesService.uploadFile(
      file.originalname, fileType, file.buffer, file.mimetype,
      { vendor, equipType, model, version },
    );
    return { message: 'Arquivo enviado com sucesso', fileName: file.originalname, fileType };
  }

  @Patch(':fileName')
  @ApiOperation({ summary: 'Atualizar metadados de um arquivo (vendor, equipType, model, version)' })
  async updateFileMeta(
    @Param('fileName') fileName: string,
    @Body() body: { vendor?: string; equipType?: string; model?: string; version?: string; fileType?: string },
  ) {
    await this.filesService.updateFileMeta(fileName, body);
    return { message: 'Metadados atualizados' };
  }

  @Delete(':fileName')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover arquivo do GenieACS' })
  async deleteFile(@Param('fileName') fileName: string) {
    return this.filesService.deleteFile(fileName);
  }
}
