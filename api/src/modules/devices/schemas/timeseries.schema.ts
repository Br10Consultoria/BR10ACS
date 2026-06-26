import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TimeSeriesDocument = TimeSeries & Document;

@Schema({
  collection: 'timeseries',
  timestamps: false,
  versionKey: false,
})
export class TimeSeries {
  @Prop({ required: true, index: true })
  serialNumber: string;

  @Prop({ required: true, index: true })
  date: Date;

  @Prop({ type: Number, default: null })
  rx: number | null;

  @Prop({ type: Number, default: null })
  tx: number | null;

  @Prop({ type: Number, default: null })
  temperature: number | null;

  @Prop({ type: Number, default: null })
  voltage: number | null;

  @Prop({ type: Object, default: {} })
  connectedHosts: {
    '5ghz': number;
    '2ghz': number;
    ethernet: number;
    total: number;
  };

  @Prop({ type: Number, default: null })
  wifiScore: number | null;

  @Prop({ type: Number, default: 0 })
  wanDownload: number;

  @Prop({ type: Number, default: 0 })
  wanUpload: number;

  @Prop({ type: Number, default: null })
  cpuUsage: number | null;

  @Prop({ type: Number, default: null })
  memoryFree: number | null;
}

export const TimeSeriesSchema = SchemaFactory.createForClass(TimeSeries);

TimeSeriesSchema.index({ serialNumber: 1, date: -1 });
TimeSeriesSchema.index({ date: -1 });
