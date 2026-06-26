import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  name: process.env.APP_NAME || 'BR10ACS',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
  swaggerEnabled: process.env.SWAGGER_ENABLED === 'true',
  swaggerPath: process.env.SWAGGER_PATH || 'api/docs',
  logLevel: process.env.LOG_LEVEL || 'info',
}));

export const dbConfig = registerAs('db', () => ({
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/br10',
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'br10acs_jwt_secret',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'br10acs_refresh_secret',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
}));

export const genieacsConfig = registerAs('genieacs', () => ({
  nbiUrl: process.env.GENIEACS_NBI_URL || 'http://localhost:7557',
  nbiUsername: process.env.GENIEACS_NBI_USERNAME || '',
  nbiPassword: process.env.GENIEACS_NBI_PASSWORD || '',
  cwmpUrl: process.env.GENIEACS_CWMP_URL || 'http://localhost:7547',
}));

export const encryptionConfig = registerAs('encryption', () => ({
  key: process.env.ENCRYPTION_KEY || 'br10acs_enc_key_32chars_change_me',
}));

export const sessionConfig = registerAs('session', () => ({
  secret: process.env.SESSION_SECRET || 'br10acs_session_secret',
  expireSeconds: parseInt(process.env.SESSION_EXPIRE_SECONDS, 10) || 3600,
}));
