import { Module, OnModuleInit } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { CollectorService } from './collector.service';
import { CollectorController } from './collector.controller';
import { TimeSeries, TimeSeriesSchema } from '../devices/schemas/timeseries.schema';
import { GenieAcsModule } from '../genieacs/genieacs.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TimeSeries.name, schema: TimeSeriesSchema }]),
    GenieAcsModule,
    AlertsModule,
  ],
  providers: [CollectorService],
  controllers: [CollectorController],
  exports: [CollectorService],
})
export class CollectorModule implements OnModuleInit {
  constructor(
    private readonly collectorService: CollectorService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const enabled = this.config.get<string>('COLLECTOR_ENABLED', 'true') === 'true';
    if (enabled) {
      this.collectorService.start();
    }
  }
}
