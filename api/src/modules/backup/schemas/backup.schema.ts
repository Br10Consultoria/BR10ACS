import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BackupDocument = Backup & Document;

@Schema({ timestamps: false })
export class Backup {
  @Prop({ required: true }) filename: string;
  @Prop({ default: 'manual' }) triggeredBy: string;
  @Prop({ enum: ['running', 'success', 'error'], default: 'running' }) status: string;
  @Prop() startedAt: Date;
  @Prop() completedAt: Date;
  @Prop({ default: 0 }) sizeBytes: number;
  @Prop() filePath: string;
  @Prop() errorMessage: string;
  @Prop({ default: false }) cloudUploaded: boolean;
  @Prop() cloudProvider: string;
  @Prop() cloudUrl: string;
}

export const BackupSchema = SchemaFactory.createForClass(Backup);
