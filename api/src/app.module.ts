import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
  ],
})
export class AppModule {}
