import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { TimeSeries, TimeSeriesSchema } from './schemas/timeseries.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TimeSeries.name, schema: TimeSeriesSchema }]),
  ],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
