import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DiagnosticsService } from './diagnostics.service';
import { DiagnosticsController } from './diagnostics.controller';
import { DiagnosticLog, DiagnosticLogSchema } from './schemas/diagnostic-log.schema';
import { TimeSeries, TimeSeriesSchema } from '../devices/schemas/timeseries.schema';
import { DevicesModule } from '../devices/devices.module';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DiagnosticLog.name, schema: DiagnosticLogSchema },
      { name: TimeSeries.name, schema: TimeSeriesSchema },
    ]),
    forwardRef(() => DevicesModule),
    LogsModule,
  ],
  controllers: [DiagnosticsController],
  providers: [DiagnosticsService],
  exports: [DiagnosticsService],
})
export class DiagnosticsModule {}
