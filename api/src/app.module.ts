import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import {
  appConfig,
  dbConfig,
  redisConfig,
  jwtConfig,
  genieacsConfig,
  encryptionConfig,
  sessionConfig,
} from './config/app.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DevicesModule } from './modules/devices/devices.module';
import { GenieAcsModule } from './modules/genieacs/genieacs.module';
import { DiagnosticsModule } from './modules/diagnostics/diagnostics.module';
import { AutoConfigModule } from './modules/autoconfig/autoconfig.module';
import { LogsModule } from './modules/logs/logs.module';
import { MassOpsModule } from './modules/mass-ops/mass-ops.module';
import { SettingsModule } from './modules/settings/settings.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { ApiClientsModule } from './modules/api-clients/api-clients.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { CollectorModule } from './modules/collector/collector.module';
import { PresetsModule } from './modules/presets/presets.module';
import { FilesModule } from './modules/files/files.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { SystemModule } from './modules/system/system.module';
import { BackupModule } from './modules/backup/backup.module';
import { TelegramBotModule } from './modules/telegram-bot/telegram-bot.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // Configuração global
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        dbConfig,
        redisConfig,
        jwtConfig,
        genieacsConfig,
        encryptionConfig,
        sessionConfig,
      ],
      envFilePath: ['.env'],
    }),

    // MongoDB — banco br10 (separado do banco genieacs)
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('db.uri'),
        dbName: 'br10',
      }),
      inject: [ConfigService],
    }),

    // Frontend estático (React build)
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'web', 'dist'),
      exclude: ['/api/*path'],
      serveStaticOptions: {
        index: 'index.html',
        fallthrough: true,
      },
    }),

    // Agendamento de tarefas
    ScheduleModule.forRoot(),

    // Módulos de negócio
    AuthModule,
    UsersModule,
    DevicesModule,
    GenieAcsModule,
    DiagnosticsModule,
    AutoConfigModule,
    LogsModule,
    MassOpsModule,
    SettingsModule,
    IntegrationsModule,
    ApiClientsModule,
    WebsocketModule,
    CollectorModule,
    PresetsModule,
    FilesModule,
    AlertsModule,
    SystemModule,
    BackupModule,
    TelegramBotModule,
    WhatsAppModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
