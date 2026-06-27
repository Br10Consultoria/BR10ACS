import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GenieAcsService } from '../genieacs/genieacs.service';
import { DeviceNormalizer } from '../devices/tr069/device-normalizer';
import { MassOp, MassOpDocument } from './schemas/mass-op.schema';
import { LogsService } from '../logs/logs.service';
import { LogCategory } from '../logs/schemas/log.schema';

@Injectable()
export class MassOpsService {
  private readonly logger = new Logger(MassOpsService.name);

  constructor(
    private genieAcsService: GenieAcsService,
    @InjectModel(MassOp.name) private massOpModel: Model<MassOpDocument>,
    private logsService: LogsService,
  ) {}

  async findAll(limit = 50): Promise<MassOpDocument[]> {
    return this.massOpModel.find().sort({ createdAt: -1 }).limit(limit).exec();
  }

  async findById(id: string): Promise<MassOpDocument> {
    const op = await this.massOpModel.findById(id).exec();
    if (!op) throw new NotFoundException('Operação não encontrada');
    return op;
  }

  async create(data: Partial<MassOp>, userId: string): Promise<MassOpDocument> {
    const payload: any = { ...data, createdBy: userId, status: 'pending', errorCount: 0, success: 0, processed: 0, total: 0, errorDetails: [] };
    const op = await this.massOpModel.create(payload);
    await this.logsService.info(`Operação em massa criada: ${data.type}`, LogCategory.MASSOP, { type: data.type, filters: data.filters }, undefined, userId).catch(() => {});
    // Executar de forma assíncrona
    this.execute((op as any)._id.toString()).catch((err: any) =>
      this.logger.error(`Erro na operação em massa ${(op as any)._id}: ${err?.message}`),
    );
    return op;
  }

  async cancel(id: string): Promise<void> {
    await this.massOpModel.findByIdAndUpdate(id, { $set: { status: 'cancelled' } }).exec();
  }

  private async execute(opId: string): Promise<void> {
    const op = await this.massOpModel.findById(opId).exec();
    if (!op || (op as any).status === 'cancelled') return;

    await this.massOpModel.findByIdAndUpdate(opId, {
      $set: { status: 'running', startedAt: new Date() },
    });

    try {
      // Buscar dispositivos que correspondem aos filtros
      const query: any = {};
      if (op.filters?.manufacturer) query['DeviceID._Manufacturer._value'] = { $regex: op.filters.manufacturer, $options: 'i' };
      if (op.filters?.model) query['DeviceID._ProductClass._value'] = { $regex: op.filters.model, $options: 'i' };
      if (op.filters?.tags?.length) query._tags = { $in: op.filters.tags };
      if (op.filters?.deviceIds?.length) query._id = { $in: op.filters.deviceIds };

      const devices = await this.genieAcsService.getDevices(query, ['_id', '_lastInform', 'DeviceID']);
      let filtered = devices.map((d) => DeviceNormalizer.normalize(d));

      if (op.filters?.online !== undefined) {
        filtered = filtered.filter((d) => d.online === op.filters.online);
      }

      await this.massOpModel.findByIdAndUpdate(opId, { $set: { total: filtered.length } });

      let success = 0;
      let errors = 0;
      const errorDetails: { deviceId: string; error: string }[] = [];

      for (const device of filtered) {
        // Verificar cancelamento
        const current = await this.massOpModel.findById(opId).exec();
        if (current?.status === 'cancelled') break;

        try {
          await this.executeAction(device.id, op.type, op.payload);
          success++;
        } catch (err: any) {
          errors++;
          errorDetails.push({ deviceId: device.id, error: err?.message || String(err) });
        }

        await this.massOpModel.findByIdAndUpdate(opId, {
          $inc: { processed: 1 },
          $set: { success, errorCount: errors, errorDetails },
        });

        // Throttle: 200ms entre cada dispositivo
        await new Promise((r) => setTimeout(r, 200));
      }

      await this.massOpModel.findByIdAndUpdate(opId, {
        $set: { status: 'completed', finishedAt: new Date() },
      });

      this.logger.log(`Operação ${opId} concluída: ${success} sucesso, ${errors} erros`);
      if (errors > 0) {
        await this.logsService.warn(`Operação em massa ${opId} concluída com ${errors} erros (${success} ok)`, LogCategory.MASSOP, { opId, success, errors }).catch(() => {});
      } else {
        await this.logsService.info(`Operação em massa ${opId} concluída: ${success} dispositivos`, LogCategory.MASSOP, { opId, success }).catch(() => {});
      }
    } catch (err: any) {
      await this.massOpModel.findByIdAndUpdate(opId, {
        $set: { status: 'failed', finishedAt: new Date() },
      });
      await this.logsService.error(`Operação em massa ${opId} falhou: ${err?.message || String(err)}`, LogCategory.MASSOP, { opId, error: err?.message }).catch(() => {});
      throw err;
    }
  }

  private async executeAction(deviceId: string, type: string, payload: any): Promise<void> {
    switch (type) {
      case 'reboot':
        await this.genieAcsService.reboot(deviceId);
        break;
      case 'factory_reset':
        await this.genieAcsService.factoryReset(deviceId);
        break;
      case 'set_parameter':
        await this.genieAcsService.setParameterValues(deviceId, [[payload.name, payload.value, payload.type]]);
        break;
      case 'add_tag':
        await this.genieAcsService.addTag(deviceId, payload.tag);
        break;
      case 'remove_tag':
        await this.genieAcsService.removeTag(deviceId, payload.tag);
        break;
      case 'connection_request':
        await this.genieAcsService.connectionRequest(deviceId);
        break;
      case 'firmware_update':
        await this.genieAcsService.downloadFirmware(deviceId, payload.fileName, payload.fileType);
        break;
      default:
        throw new Error(`Tipo de operação desconhecido: ${type}`);
    }
  }
}
