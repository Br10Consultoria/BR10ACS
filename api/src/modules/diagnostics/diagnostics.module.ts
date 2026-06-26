import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DiagnosticsService } from './diagnostics.service';
import { DiagnosticsController } from './diagnostics.controller';
import { DiagnosticLog, DiagnosticLogSchema } from './schemas/diagnostic-log.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: DiagnosticLog.name, schema: DiagnosticLogSchema }])],
  controllers: [DiagnosticsController],
  providers: [DiagnosticsService],
  exports: [DiagnosticsService],
})
export class DiagnosticsModule {}
