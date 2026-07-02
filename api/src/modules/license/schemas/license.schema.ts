import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LicenseDocument = License & Document;

export type LicenseStatus = 'active' | 'expired' | 'invalid' | 'trial' | 'pending';

@Schema({ collection: 'license', timestamps: true, versionKey: false })
export class License {
  /** Chave de licença fornecida pelo cliente */
  @Prop({ required: true, unique: true })
  key: string;

  /** Status atual da licença */
  @Prop({ default: 'pending' })
  status: LicenseStatus;

  /** Data de expiração da licença */
  @Prop()
  expiresAt: Date;

  /** Data da última verificação com o servidor de licenças */
  @Prop()
  lastCheckedAt: Date;

  /** Resposta completa do servidor de licenças (cache) */
  @Prop({ type: Object })
  serverResponse: Record<string, unknown>;

  /** Identificador da instalação (fingerprint do servidor) */
  @Prop()
  instanceId: string;

  /** Nome do titular da licença */
  @Prop()
  holderName: string;

  /** E-mail do titular da licença */
  @Prop()
  holderEmail: string;

  /** Plano contratado */
  @Prop()
  plan: string;

  /** Máximo de dispositivos permitidos (0 = ilimitado) */
  @Prop({ default: 0 })
  maxDevices: number;
}

export const LicenseSchema = SchemaFactory.createForClass(License);
