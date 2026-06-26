import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ApiClientDocument = ApiClient & Document;

@Schema({ collection: 'api_clients', timestamps: true, versionKey: false })
export class ApiClient {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, select: false })
  apiKey: string;

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ type: [String], default: [] })
  allowedIps: string[];

  @Prop({ type: [String], default: ['read'] })
  permissions: string[];

  @Prop({ type: Object, default: {} })
  stats: { requests: number; lastUsed?: Date };
}

export const ApiClientSchema = SchemaFactory.createForClass(ApiClient);
