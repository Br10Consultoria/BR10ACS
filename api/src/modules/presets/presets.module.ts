import { Module } from '@nestjs/common';
import { PresetsController } from './presets.controller';
import { PresetsService } from './presets.service';
import { GenieAcsModule } from '../genieacs/genieacs.module';

@Module({
  imports: [GenieAcsModule],
  controllers: [PresetsController],
  providers: [PresetsService],
  exports: [PresetsService],
})
export class PresetsModule {}
