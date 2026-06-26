import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TimeSeriesDocument = TimeSeries & Document;

@Schema({
  collection: 'timeseries',
  timestamps: false,
  versionKey: false,
  strict: false,
})
export class TimeSeries {
  @Prop({ required: true, index: true })
  deviceId: string;

  @Prop({ required: true, index: true })
  timestamp: Date;

  @Prop({ type: Boolean, default: false })
  online: boolean;

  @Prop({ type: Number, default: null })
  rxDbm: number | null;

  @Prop({ type: Number, default: null })
  txDbm: number | null;

  @Prop({ type: Number, default: null })
  temperature: number | null;

  @Prop({ type: Number, default: null })
  voltage: number | null;

  @Prop({ type: Number, default: null })
  totalBytesReceived: number | null;

  @Prop({ type: Number, default: null })
  totalBytesSent: number | null;

  @Prop({ type: Number, default: null })
  totalDownloadMB: number | null;

  @Prop({ type: Number, default: null })
  totalUploadMB: number | null;

  @Prop({ type: Number, default: 0 })
  totalAssociated: number;

  @Prop({ type: Number, default: 0 })
  hostsCount: number;

  @Prop({ type: String, default: null })
  uptime: string | null;

  @Prop({ type: String, default: null })
  linkStatus: string | null;
}

export const TimeSeriesSchema = SchemaFactory.createForClass(TimeSeries);

TimeSeriesSchema.index({ deviceId: 1, timestamp: -1 }, { unique: true });
TimeSeriesSchema.index({ timestamp: -1 });
