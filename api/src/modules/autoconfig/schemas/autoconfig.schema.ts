import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AutoConfigDocument = AutoConfig & Document;

@Schema({ collection: 'auto_configs', timestamps: true, versionKey: false })
export class AutoConfig {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ default: 0 })
  priority: number;

  // Condições de aplicação
  @Prop({ type: Object, default: {} })
  conditions: {
    manufacturer?: string;
    model?: string;
    oui?: string;
    tags?: string[];
    serialPattern?: string;
    firmwareVersion?: string;
  };

  // Parâmetros a definir
  @Prop({ type: [Object], default: [] })
  parameters: {
    name: string;
    value: any;
    type: string;
  }[];

  // Presets GenieACS a aplicar
  @Prop({ type: [String], default: [] })
  presets: string[];

  // Tags a adicionar
  @Prop({ type: [String], default: [] })
  tagsToAdd: string[];

  @Prop({ type: Object, default: {} })
  stats: {
    applied: number;
    errors: number;
    lastApplied?: Date;
  };
}

export const AutoConfigSchema = SchemaFactory.createForClass(AutoConfig);
