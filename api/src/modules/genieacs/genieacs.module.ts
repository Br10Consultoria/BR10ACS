import { Module, Global } from '@nestjs/common';
import { GenieAcsService } from './genieacs.service';

@Global()
@Module({
  providers: [GenieAcsService],
  exports: [GenieAcsService],
})
export class GenieAcsModule {}
