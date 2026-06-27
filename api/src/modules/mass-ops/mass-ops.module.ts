import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MassOpsService } from './mass-ops.service';
import { MassOpsController } from './mass-ops.controller';
import { MassOp, MassOpSchema } from './schemas/mass-op.schema';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: MassOp.name, schema: MassOpSchema }]),
    LogsModule,
  ],
  controllers: [MassOpsController],
  providers: [MassOpsService],
  exports: [MassOpsService],
})
export class MassOpsModule {}
