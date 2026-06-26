import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SettingsDocument = Settings & Document;

@Schema({ collection: 'settings', timestamps: true, versionKey: false })
export class Settings {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ type: Object })
  value: any;

  @Prop()
  description: string;

  @Prop({ default: false })
  isSecret: boolean;
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);
