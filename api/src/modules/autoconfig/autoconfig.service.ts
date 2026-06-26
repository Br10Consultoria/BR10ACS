import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GenieAcsService } from '../genieacs/genieacs.service';
import { DeviceNormalizer } from '../devices/tr069/device-normalizer';
import { AutoConfig, AutoConfigDocument } from './schemas/autoconfig.schema';

@Injectable()
export class AutoConfigService {
  private readonly logger = new Logger(AutoConfigService.name);

  constructor(
    private genieAcsService: GenieAcsService,
    @InjectModel(AutoConfig.name) private autoConfigModel: Model<AutoConfigDocument>,
  ) {}

  async findAll(): Promise<AutoConfigDocument[]> {
    return this.autoConfigModel.find().sort({ priority: -1 }).exec();
  }

  async findById(id: string): Promise<AutoConfigDocument> {
    const doc = await this.autoConfigModel.findById(id).exec();
    if (!doc) throw new NotFoundException('AutoConfig não encontrado');
    return doc;
  }

  async create(data: Partial<AutoConfig>): Promise<AutoConfigDocument> {
    return this.autoConfigModel.create(data);
  }

  async update(id: string, data: Partial<AutoConfig>): Promise<AutoConfigDocument> {
    const doc = await this.autoConfigModel.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after' }).exec();
    if (!doc) throw new NotFoundException('AutoConfig não encontrado');
    return doc;
  }

  async remove(id: string): Promise<void> {
    await this.autoConfigModel.findByIdAndDelete(id).exec();
  }

  async applyToDevice(deviceId: string): Promise<{ applied: string[]; errors: string[] }> {
    const device = await this.genieAcsService.getDevice(deviceId);
    if (!device) throw new NotFoundException(`Dispositivo ${deviceId} não encontrado`);

    const normalized = DeviceNormalizer.normalize(device);
    const configs = await this.autoConfigModel.find({ enabled: true }).sort({ priority: -1 }).exec();
    const applied: string[] = [];
    const errors: string[] = [];

    for (const config of configs) {
      if (!this.matchesConditions(normalized, config.conditions)) continue;

      try {
        if (config.parameters?.length > 0) {
          const values: [string, any, string][] = config.parameters.map((p) => [p.name, p.value, p.type]);
          await this.genieAcsService.setParameterValues(deviceId, values);
        }

        for (const tag of config.tagsToAdd || []) {
          await this.genieAcsService.addTag(deviceId, tag);
        }

        await this.autoConfigModel.findByIdAndUpdate(config._id, {
          $inc: { 'stats.applied': 1 },
          $set: { 'stats.lastApplied': new Date() },
        });

        applied.push(config.name);
      } catch (err: any) {
        this.logger.error(`Erro ao aplicar AutoConfig ${config.name} em ${deviceId}: ${err?.message}`);
        await this.autoConfigModel.findByIdAndUpdate(config._id, { $inc: { 'stats.errors': 1 } });
        errors.push(`${config.name}: ${err?.message || String(err)}`);
      }
    }

    return { applied, errors };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runAutoConfigCron(): Promise<void> {
    this.logger.log('Executando AutoConfig periódico...');
    const configs = await this.autoConfigModel.find({ enabled: true }).exec();
    if (!configs.length) return;

    const devices = await this.genieAcsService.getDevices({}, ['_id', '_lastInform', 'DeviceID']);
    let applied = 0;

    for (const device of devices) {
      const normalized = DeviceNormalizer.normalize(device);
      for (const config of configs) {
        if (this.matchesConditions(normalized, config.conditions)) {
          try {
            if (config.parameters?.length > 0) {
              const values: [string, any, string][] = config.parameters.map((p) => [p.name, p.value, p.type]);
              await this.genieAcsService.setParameterValues(device._id, values);
              applied++;
            }
          } catch {
            // silencioso no cron
          }
        }
      }
    }

    this.logger.log(`AutoConfig periódico concluído: ${applied} aplicações`);
  }

  private matchesConditions(device: any, conditions: AutoConfig['conditions']): boolean {
    if (!conditions) return true;
    if (conditions.manufacturer && !device.manufacturer?.toLowerCase().includes(conditions.manufacturer.toLowerCase())) return false;
    if (conditions.model && !device.model?.toLowerCase().includes(conditions.model.toLowerCase())) return false;
    if (conditions.oui && device.oui !== conditions.oui) return false;
    if (conditions.serialPattern) {
      const re = new RegExp(conditions.serialPattern, 'i');
      if (!re.test(device.serialNumber)) return false;
    }
    if (conditions.tags?.length) {
      const hasAll = conditions.tags.every((t) => device.tags?.includes(t));
      if (!hasAll) return false;
    }
    return true;
  }
}
