import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AutoConfigService } from './autoconfig.service';
import { AutoConfigController } from './autoconfig.controller';
import { AutoConfig, AutoConfigSchema } from './schemas/autoconfig.schema';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AutoConfig.name, schema: AutoConfigSchema }]),
    LogsModule,
  ],
  controllers: [AutoConfigController],
  providers: [AutoConfigService],
  exports: [AutoConfigService],
})
export class AutoConfigModule {}
