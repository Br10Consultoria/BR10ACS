import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppSession, WhatsAppSessionSchema } from './schemas/whatsapp-session.schema';
import { SettingsModule } from '../settings/settings.module';
import { LogsModule } from '../logs/logs.module';
import { GenieAcsModule } from '../genieacs/genieacs.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { Integration, IntegrationSchema } from '../integrations/schemas/integration.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WhatsAppSession.name, schema: WhatsAppSessionSchema },
      { name: Integration.name, schema: IntegrationSchema },
    ]),
    SettingsModule,
    LogsModule,
    GenieAcsModule,
    IntegrationsModule,
  ],
  controllers: [WhatsAppController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
