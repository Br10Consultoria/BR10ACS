import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DiagnosticLogDocument = DiagnosticLog & Document;

@Schema({ collection: 'diagnostic_logs', timestamps: false, versionKey: false })
export class DiagnosticLog {
  @Prop({ required: true, index: true })
  deviceId: string;

  @Prop({ required: true, enum: ['ping', 'traceroute', 'speedtest'] })
  type: string;

  @Prop()
  host: string;

  @Prop({ enum: ['running', 'pending_result', 'completed', 'error'], default: 'running' })
  status: string;

  @Prop({ type: Object })
  result: Record<string, any>;

  @Prop()
  error: string;

  @Prop({ required: true })
  startedAt: Date;

  @Prop()
  finishedAt: Date;

  @Prop()
  startedBy: string;
}

export const DiagnosticLogSchema = SchemaFactory.createForClass(DiagnosticLog);
DiagnosticLogSchema.index({ deviceId: 1, startedAt: -1 });
