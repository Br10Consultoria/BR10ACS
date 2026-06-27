import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramBotController } from './telegram-bot.controller';
import { SettingsModule } from '../settings/settings.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { Integration, IntegrationSchema } from '../integrations/schemas/integration.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Integration.name, schema: IntegrationSchema }]),
    SettingsModule,
    IntegrationsModule,
  ],
  controllers: [TelegramBotController],
  providers: [TelegramBotService],
  exports: [TelegramBotService],
})
export class TelegramBotModule {}
