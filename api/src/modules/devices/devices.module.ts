import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { TimeSeries, TimeSeriesSchema } from './schemas/timeseries.schema';
import { CollectorModule } from '../collector/collector.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TimeSeries.name, schema: TimeSeriesSchema }]),
    forwardRef(() => CollectorModule),
  ],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
