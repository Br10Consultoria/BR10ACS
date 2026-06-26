import {
  Controller, Get, Post, Delete, Param, Query,
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
  @ApiOperation({ summary: 'Fazer upload de arquivo para o GenieACS' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('fileType') fileType = '1 Firmware Upgrade Image',
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado');
    await this.filesService.uploadFile(file.originalname, fileType, file.buffer, file.mimetype);
    return { message: 'Arquivo enviado com sucesso', fileName: file.originalname, fileType };
  }

  @Delete(':fileName')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover arquivo do GenieACS' })
  async deleteFile(@Param('fileName') fileName: string) {
    return this.filesService.deleteFile(fileName);
  }
}
