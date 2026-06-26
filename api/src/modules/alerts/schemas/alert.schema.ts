import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AlertDocument = Alert & Document;

export enum AlertType {
  DEVICE_OFFLINE = 'device_offline',
  DEVICE_ONLINE = 'device_online',
  SIGNAL_CRITICAL = 'signal_critical',
  SIGNAL_RECOVERED = 'signal_recovered',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

@Schema({ collection: 'alerts', timestamps: true, versionKey: false })
export class Alert {
  @Prop({ required: true, index: true })
  deviceId: string;

  @Prop({ type: String })
  deviceSerial?: string;

  @Prop({ type: String })
  deviceModel?: string;

  @Prop({ type: String })
  pppLogin?: string;

  @Prop({ required: true, enum: Object.values(AlertType) })
  type: AlertType;

  @Prop({ required: true, enum: Object.values(AlertSeverity) })
  severity: AlertSeverity;

  @Prop({ required: true })
  message: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ default: false })
  acknowledged: boolean;

  @Prop({ type: Date, default: null })
  acknowledgedAt?: Date;

  @Prop({ type: String, default: null })
  acknowledgedBy?: string;

  @Prop({ default: false })
  notified: boolean;

  @Prop({ type: Date, default: null })
  notifiedAt?: Date;
}

export const AlertSchema = SchemaFactory.createForClass(Alert);
AlertSchema.index({ deviceId: 1, type: 1, createdAt: -1 });
AlertSchema.index({ acknowledged: 1, createdAt: -1 });
