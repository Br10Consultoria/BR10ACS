import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { IxcService } from './ixc.service';
import { Integration, IntegrationSchema } from './schemas/integration.schema';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Integration.name, schema: IntegrationSchema }]),
    LogsModule,
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, IxcService],
  exports: [IntegrationsService, IxcService],
})
export class IntegrationsModule {}
