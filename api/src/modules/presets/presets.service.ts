import { Injectable } from '@nestjs/common';
import { GenieAcsService } from '../genieacs/genieacs.service';

@Injectable()
export class PresetsService {
  constructor(private readonly genieAcs: GenieAcsService) {}

  // ── Presets ──────────────────────────────────────────────────────────────────

  async listPresets(): Promise<any[]> {
    return this.genieAcs.getPresets();
  }

  async putPreset(name: string, preset: object): Promise<void> {
    return this.genieAcs.putPreset(name, preset);
  }

  async deletePreset(name: string): Promise<void> {
    return this.genieAcs.deletePreset(name);
  }

  // ── Provisions ───────────────────────────────────────────────────────────────

  async listProvisions(): Promise<any[]> {
    return this.genieAcs.getProvisions();
  }

  async putProvision(name: string, script: string): Promise<void> {
    return this.genieAcs.putProvision(name, script);
  }

  async deleteProvision(name: string): Promise<void> {
    return this.genieAcs.deleteProvision(name);
  }
}
