import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DiagnosticsService } from './diagnostics.service';
import { DiagnosticsController, AiConfigController } from './diagnostics.controller';
import { DiagnosticLog, DiagnosticLogSchema } from './schemas/diagnostic-log.schema';
import { TimeSeries, TimeSeriesSchema } from '../devices/schemas/timeseries.schema';
import { DevicesModule } from '../devices/devices.module';
import { LogsModule } from '../logs/logs.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DiagnosticLog.name, schema: DiagnosticLogSchema },
      { name: TimeSeries.name, schema: TimeSeriesSchema },
    ]),
    forwardRef(() => DevicesModule),
    LogsModule,
    SettingsModule,
  ],
  controllers: [DiagnosticsController, AiConfigController],
  providers: [DiagnosticsService],
  exports: [DiagnosticsService],
})
export class DiagnosticsModule {}
