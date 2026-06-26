import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LogDocument = Log & Document;

export enum LogLevel { INFO = 'info', WARN = 'warn', ERROR = 'error', DEBUG = 'debug' }
export enum LogCategory {
  AUTH = 'auth', DEVICE = 'device', CWMP = 'cwmp',
  AUTOCONFIG = 'autoconfig', MASSOP = 'massop',
  INTEGRATION = 'integration', SYSTEM = 'system',
}

@Schema({ collection: 'logs', timestamps: false, versionKey: false })
export class Log {
  @Prop({ required: true, index: true })
  date: Date;

  @Prop({ type: String, enum: LogLevel, default: LogLevel.INFO })
  level: LogLevel;

  @Prop({ type: String, enum: LogCategory, default: LogCategory.SYSTEM })
  category: LogCategory;

  @Prop({ index: true })
  deviceId: string;

  @Prop()
  userId: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: Object })
  metadata: Record<string, any>;
}

export const LogSchema = SchemaFactory.createForClass(Log);
LogSchema.index({ date: -1 });
LogSchema.index({ deviceId: 1, date: -1 });
LogSchema.index({ category: 1, date: -1 });
