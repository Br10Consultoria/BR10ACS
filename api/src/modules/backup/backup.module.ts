import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { Backup, BackupSchema } from './schemas/backup.schema';
import { SettingsModule } from '../settings/settings.module';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Backup.name, schema: BackupSchema }]),
    SettingsModule,
    LogsModule,
  ],
  controllers: [BackupController],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}
