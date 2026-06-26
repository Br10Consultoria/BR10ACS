import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AutoConfigService } from './autoconfig.service';
import { AutoConfigController } from './autoconfig.controller';
import { AutoConfig, AutoConfigSchema } from './schemas/autoconfig.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: AutoConfig.name, schema: AutoConfigSchema }])],
  controllers: [AutoConfigController],
  providers: [AutoConfigService],
  exports: [AutoConfigService],
})
export class AutoConfigModule {}
