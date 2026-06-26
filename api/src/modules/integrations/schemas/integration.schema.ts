import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IntegrationDocument = Integration & Document;

@Schema({ collection: 'integrations', timestamps: true, versionKey: false })
export class Integration {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true, enum: ['ixc', 'mk', 'sgp', 'voalle', 'webhook', 'slack', 'telegram', 'custom'] })
  type: string;

  @Prop({ default: false })
  enabled: boolean;

  @Prop({ type: Object, default: {} })
  config: Record<string, any>;

  @Prop({ type: Object, default: {} })
  stats: {
    requests: number;
    errors: number;
    lastUsed?: Date;
  };
}

export const IntegrationSchema = SchemaFactory.createForClass(Integration);
