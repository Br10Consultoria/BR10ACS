import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiClientsService } from './api-clients.service';
import { ApiClientsController } from './api-clients.controller';
import { ApiClient, ApiClientSchema } from './schemas/api-client.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: ApiClient.name, schema: ApiClientSchema }])],
  controllers: [ApiClientsController],
  providers: [ApiClientsService],
  exports: [ApiClientsService],
})
export class ApiClientsModule {}
