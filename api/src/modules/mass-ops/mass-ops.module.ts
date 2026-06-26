import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MassOpsService } from './mass-ops.service';
import { MassOpsController } from './mass-ops.controller';
import { MassOp, MassOpSchema } from './schemas/mass-op.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: MassOp.name, schema: MassOpSchema }])],
  controllers: [MassOpsController],
  providers: [MassOpsService],
  exports: [MassOpsService],
})
export class MassOpsModule {}
