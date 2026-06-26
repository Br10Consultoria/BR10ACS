import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MassOpDocument = MassOp & Document;

@Schema({ collection: 'mass_ops', timestamps: true, versionKey: false })
export class MassOp {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: ['reboot', 'factory_reset', 'set_parameter', 'add_tag', 'remove_tag', 'connection_request', 'firmware_update'] })
  type: string;

  @Prop({ enum: ['pending', 'running', 'completed', 'failed', 'cancelled'], default: 'pending' })
  status: string;

  @Prop({ type: Object, default: {} })
  filters: {
    manufacturer?: string;
    model?: string;
    tags?: string[];
    deviceIds?: string[];
    online?: boolean;
  };

  @Prop({ type: Object, default: {} })
  payload: Record<string, any>;

  @Prop({ default: 0 })
  total: number;

  @Prop({ default: 0 })
  processed: number;

  @Prop({ default: 0 })
  success: number;

  @Prop({ default: 0 })
  errors: number;

  @Prop({ type: [Object], default: [] })
  errorDetails: { deviceId: string; error: string }[];

  @Prop()
  startedAt: Date;

  @Prop()
  finishedAt: Date;

  @Prop()
  createdBy: string;
}

export const MassOpSchema = SchemaFactory.createForClass(MassOp);
MassOpSchema.index({ status: 1, createdAt: -1 });
