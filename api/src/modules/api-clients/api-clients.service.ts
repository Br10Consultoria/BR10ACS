import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { ApiClient, ApiClientDocument } from './schemas/api-client.schema';

@Injectable()
export class ApiClientsService {
  constructor(@InjectModel(ApiClient.name) private apiClientModel: Model<ApiClientDocument>) {}

  async findAll(): Promise<ApiClientDocument[]> {
    return this.apiClientModel.find().exec();
  }

  async create(data: Partial<ApiClient>): Promise<ApiClientDocument & { apiKey: string }> {
    const apiKey = `br10_${randomBytes(32).toString('hex')}`;
    const doc = await this.apiClientModel.create({ ...data, apiKey });
    return { ...doc.toObject(), apiKey } as any;
  }

  async revoke(id: string): Promise<void> {
    await this.apiClientModel.findByIdAndUpdate(id, { $set: { enabled: false } }).exec();
  }

  async remove(id: string): Promise<void> {
    await this.apiClientModel.findByIdAndDelete(id).exec();
  }

  async validateApiKey(key: string): Promise<ApiClientDocument | null> {
    const client = await this.apiClientModel.findOne({ apiKey: key, enabled: true }).select('+apiKey').exec();
    if (client) {
      await this.apiClientModel.findByIdAndUpdate(client._id, {
        $inc: { 'stats.requests': 1 },
        $set: { 'stats.lastUsed': new Date() },
      });
    }
    return client;
  }
}
