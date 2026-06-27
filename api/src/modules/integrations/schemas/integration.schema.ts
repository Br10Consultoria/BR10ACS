import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IntegrationDocument = Integration & Document;

@Schema({ collection: 'integrations', timestamps: true, versionKey: false })
export class Integration {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({
    required: true,
    enum: ['ixc', 'mk', 'sgp', 'hubsoft', 'leaf', 'spify', 'voalle', 'webhook', 'slack', 'telegram', 'custom'],
  })
  type: string;

  @Prop({ default: false })
  enabled: boolean;

  @Prop({ type: Object, default: {} })
  config: Record<string, any>;

  /** Mapeamento de campos personalizado (sobrescreve o adaptador padrão) */
  @Prop({ type: Object, default: null })
  fieldMap: Record<string, string> | null;

  @Prop({ type: Object, default: { requests: 0, errors: 0 } })
  stats: {
    requests: number;
    errors: number;
    lastUsed?: Date;
  };
}

export const IntegrationSchema = SchemaFactory.createForClass(Integration);
