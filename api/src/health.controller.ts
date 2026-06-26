import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Public } from './modules/auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly mongoConnection: Connection) {}

  @Public()
  @Get()
  check() {
    const mongoState = this.mongoConnection.readyState;
    // 1 = connected, 2 = connecting
    const mongoOk = mongoState === 1 || mongoState === 2;

    return {
      status: mongoOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        mongodb: mongoOk ? 'connected' : 'disconnected',
      },
    };
  }
}
