import { Injectable } from '@nestjs/common';
import { GenieAcsService } from '../genieacs/genieacs.service';

@Injectable()
export class FilesService {
  constructor(private readonly genieAcs: GenieAcsService) {}

  async listFiles(): Promise<any[]> {
    return this.genieAcs.getFiles();
  }

  async uploadFile(fileName: string, fileType: string, buffer: Buffer, mimeType?: string): Promise<void> {
    return this.genieAcs.uploadFile(fileName, fileType, buffer, mimeType);
  }

  async deleteFile(fileName: string): Promise<void> {
    return this.genieAcs.deleteFile(fileName);
  }
}
