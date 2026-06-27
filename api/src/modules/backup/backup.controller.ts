import {
  Controller, Get, Post, Delete, Param, Res, HttpException, HttpStatus, UseGuards, Body,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackupService } from './backup.service';
import { SettingsService } from '../settings/settings.service';

@Controller('v1/backup')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly settingsService: SettingsService,
  ) {}

  /** Inicia um backup manual */
  @Post('run')
  async runBackup() {
    const result = await this.backupService.runBackup('manual');
    return result;
  }

  /** Lista os backups realizados */
  @Get()
  async listBackups() {
    return this.backupService.listBackups(50);
  }

  /** Download de um backup específico */
  @Get(':id/download')
  async downloadBackup(@Param('id') id: string, @Res() res: Response) {
    const filePath = await this.backupService.getBackupFilePath(id);
    if (!filePath) {
      throw new HttpException('Backup não encontrado ou arquivo removido', HttpStatus.NOT_FOUND);
    }
    const filename = filePath.split('/').pop() || 'backup.gz';
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/gzip');
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  /** Remove um backup */
  @Delete(':id')
  async deleteBackup(@Param('id') id: string) {
    await this.backupService.deleteBackup(id);
    return { success: true };
  }

  /** Retorna a configuração de agendamento */
  @Get('schedule')
  async getSchedule() {
    return this.backupService.getScheduleConfig();
  }

  /** Salva a configuração de agendamento e cloud */
  @Post('schedule')
  async saveSchedule(@Body() body: any) {
    const entries: Array<{ key: string; value: any }> = [];

    if (body.daily !== undefined) {
      entries.push({ key: 'backup.schedule.daily.enabled', value: body.daily.enabled });
      if (body.daily.time) entries.push({ key: 'backup.schedule.daily.time', value: body.daily.time });
    }
    if (body.weekly !== undefined) {
      entries.push({ key: 'backup.schedule.weekly.enabled', value: body.weekly.enabled });
      if (body.weekly.dayOfWeek !== undefined) entries.push({ key: 'backup.schedule.weekly.dayOfWeek', value: body.weekly.dayOfWeek });
      if (body.weekly.time) entries.push({ key: 'backup.schedule.weekly.time', value: body.weekly.time });
    }
    if (body.monthly !== undefined) {
      entries.push({ key: 'backup.schedule.monthly.enabled', value: body.monthly.enabled });
      if (body.monthly.dayOfMonth !== undefined) entries.push({ key: 'backup.schedule.monthly.dayOfMonth', value: body.monthly.dayOfMonth });
      if (body.monthly.time) entries.push({ key: 'backup.schedule.monthly.time', value: body.monthly.time });
    }
    if (body.retentionDays !== undefined) {
      entries.push({ key: 'backup.retentionDays', value: body.retentionDays });
    }
    if (body.cloud !== undefined) {
      entries.push({ key: 'backup.cloud.enabled', value: body.cloud.enabled });
      if (body.cloud.provider !== undefined) entries.push({ key: 'backup.cloud.provider', value: body.cloud.provider });
      if (body.cloud.dropbox?.accessToken !== undefined) entries.push({ key: 'backup.cloud.dropbox.accessToken', value: body.cloud.dropbox.accessToken });
      if (body.cloud.gdrive?.serviceAccountJson !== undefined) entries.push({ key: 'backup.cloud.gdrive.serviceAccountJson', value: body.cloud.gdrive.serviceAccountJson });
      if (body.cloud.gdrive?.folderId !== undefined) entries.push({ key: 'backup.cloud.gdrive.folderId', value: body.cloud.gdrive.folderId });
      if (body.cloud.s3?.bucket !== undefined) entries.push({ key: 'backup.cloud.s3.bucket', value: body.cloud.s3.bucket });
      if (body.cloud.s3?.region !== undefined) entries.push({ key: 'backup.cloud.s3.region', value: body.cloud.s3.region });
      if (body.cloud.s3?.accessKeyId !== undefined) entries.push({ key: 'backup.cloud.s3.accessKeyId', value: body.cloud.s3.accessKeyId });
      if (body.cloud.s3?.secretAccessKey !== undefined) entries.push({ key: 'backup.cloud.s3.secretAccessKey', value: body.cloud.s3.secretAccessKey });
      if (body.cloud.webhookUrl !== undefined) entries.push({ key: 'backup.cloud.webhookUrl', value: body.cloud.webhookUrl });
    }

    for (const entry of entries) {
      await this.settingsService.set(entry.key, entry.value);
    }

    return { success: true, saved: entries.length };
  }
}
