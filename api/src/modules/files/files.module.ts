import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { GenieAcsModule } from '../genieacs/genieacs.module';

@Module({
  imports: [
    GenieAcsModule,
    MulterModule.register({ storage: undefined }), // memoryStorage (buffer)
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
