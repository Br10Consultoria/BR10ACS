import { Injectable } from '@nestjs/common';
import { GenieAcsService } from '../genieacs/genieacs.service';

export interface FileMeta {
  vendor?: string;
  equipType?: string;
  model?: string;
  version?: string;
  fileType?: string;
}

@Injectable()
export class FilesService {
  constructor(private readonly genieAcs: GenieAcsService) {}

  async listFiles(): Promise<any[]> {
    return this.genieAcs.getFiles();
  }

  async uploadFile(
    fileName: string,
    fileType: string,
    buffer: Buffer,
    mimeType?: string,
    meta?: FileMeta,
  ): Promise<void> {
    return this.genieAcs.uploadFile(fileName, fileType, buffer, mimeType, meta);
  }

  async updateFileMeta(fileName: string, meta: FileMeta): Promise<void> {
    // GenieACS não tem PATCH nativo para metadados — re-upload com novos headers
    const files = await this.genieAcs.getFiles();
    const existing = files.find((f: any) => f._id === fileName);
    if (!existing) throw new Error(`Arquivo "${fileName}" não encontrado`);
    const buffer = await this.genieAcs.downloadFile(fileName);
    const fileType = meta.fileType || existing.metadata?.fileType || '1 Firmware Upgrade Image';
    const mergedMeta: FileMeta = {
      vendor:    meta.vendor    ?? existing.metadata?.vendor,
      equipType: meta.equipType ?? existing.metadata?.equipType,
      model:     meta.model     ?? existing.metadata?.model,
      version:   meta.version   ?? existing.metadata?.version,
    };
    await this.genieAcs.uploadFile(fileName, fileType, buffer, undefined, mergedMeta);
  }

  async deleteFile(fileName: string): Promise<void> {
    return this.genieAcs.deleteFile(fileName);
  }
}
