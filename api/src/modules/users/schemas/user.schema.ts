import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BLOCKED = 'blocked',
}

@Schema({
  collection: 'users',
  timestamps: true,
  versionKey: false,
})
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  username: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, enum: UserRole, default: UserRole.OPERATOR })
  role: UserRole;

  @Prop({ type: String, enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Prop({ default: false })
  twoFactorEnabled: boolean;

  @Prop({ select: false })
  twoFactorSecret?: string;

  @Prop({ type: [String], default: [] })
  allowedRoutes: string[];

  @Prop({ type: Object, default: {} })
  preferences: Record<string, any>;

  @Prop()
  lastLogin?: Date;

  @Prop()
  lastPasswordChange?: Date;

  @Prop({ default: 0 })
  loginAttempts: number;

  @Prop()
  blockedUntil?: Date;

  @Prop({ select: false })
  refreshToken?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Índices adicionais (username e email já têm unique:true no @Prop)
UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });
