import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { Integration, IntegrationDocument } from './schemas/integration.schema';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(@InjectModel(Integration.name) private integrationModel: Model<IntegrationDocument>) {}

  async findAll(): Promise<IntegrationDocument[]> {
    return this.integrationModel.find().exec();
  }

  async findById(id: string): Promise<IntegrationDocument> {
    const doc = await this.integrationModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Integração não encontrada');
    return doc;
  }

  async create(data: Partial<Integration>): Promise<IntegrationDocument> {
    return this.integrationModel.create(data);
  }

  async update(id: string, data: Partial<Integration>): Promise<IntegrationDocument> {
    const doc = await this.integrationModel.findByIdAndUpdate(id, { $set: data }, { new: true }).exec();
    if (!doc) throw new NotFoundException('Integração não encontrada');
    return doc;
  }

  async remove(id: string): Promise<void> {
    await this.integrationModel.findByIdAndDelete(id).exec();
  }

  async testWebhook(id: string, payload: any): Promise<any> {
    const integration = await this.findById(id);
    if (integration.type !== 'webhook') throw new Error('Integração não é do tipo webhook');

    const url = integration.config?.url;
    if (!url) throw new Error('URL do webhook não configurada');

    const res = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json', ...(integration.config?.headers || {}) },
      timeout: 10000,
    });

    await this.integrationModel.findByIdAndUpdate(id, {
      $inc: { 'stats.requests': 1 },
      $set: { 'stats.lastUsed': new Date() },
    });

    return { status: res.status, data: res.data };
  }

  async sendWebhookEvent(type: string, payload: any): Promise<void> {
    const webhooks = await this.integrationModel.find({ type: 'webhook', enabled: true }).exec();
    for (const wh of webhooks) {
      try {
        await axios.post(wh.config?.url, { event: type, ...payload }, {
          headers: { 'Content-Type': 'application/json', ...(wh.config?.headers || {}) },
          timeout: 5000,
        });
        await this.integrationModel.findByIdAndUpdate(wh._id, {
          $inc: { 'stats.requests': 1 },
          $set: { 'stats.lastUsed': new Date() },
        });
      } catch (err: any) {
        this.logger.error(`Webhook ${wh.name} falhou: ${err?.message}`);
        await this.integrationModel.findByIdAndUpdate(wh._id, { $inc: { 'stats.errors': 1 } });
      }
    }
  }
}
