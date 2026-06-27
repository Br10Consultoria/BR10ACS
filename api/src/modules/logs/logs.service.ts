import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Log, LogDocument, LogLevel, LogCategory } from './schemas/log.schema';

@Injectable()
export class LogsService {
  constructor(@InjectModel(Log.name) private logModel: Model<LogDocument>) {}

  async log(
    message: string,
    level: LogLevel = LogLevel.INFO,
    category: LogCategory = LogCategory.SYSTEM,
    metadata?: Record<string, any>,
    deviceId?: string,
    userId?: string,
  ): Promise<void> {
    await this.logModel.create({ date: new Date(), level, category, message, metadata, deviceId, userId });
  }

  async info(message: string, category = LogCategory.SYSTEM, meta?: any, deviceId?: string, userId?: string) {
    return this.log(message, LogLevel.INFO, category, meta, deviceId, userId);
  }

  async warn(message: string, category = LogCategory.SYSTEM, meta?: any, deviceId?: string, userId?: string) {
    return this.log(message, LogLevel.WARN, category, meta, deviceId, userId);
  }

  async error(message: string, category = LogCategory.SYSTEM, meta?: any, deviceId?: string, userId?: string) {
    return this.log(message, LogLevel.ERROR, category, meta, deviceId, userId);
  }

  async query(filters: {
    deviceId?: string;
    category?: LogCategory;
    level?: LogLevel;
    from?: Date;
    to?: Date;
    limit?: number;
    page?: number;
    search?: string;
  }): Promise<{ data: LogDocument[]; total: number }> {
    const query: any = {};
    if (filters.deviceId) query.deviceId = filters.deviceId;
    if (filters.category) query.category = filters.category;
    if (filters.level) query.level = filters.level;
    if (filters.search) query.message = { $regex: filters.search, $options: 'i' };
    if (filters.from || filters.to) {
      query.date = {};
      if (filters.from) query.date.$gte = filters.from;
      if (filters.to) query.date.$lte = filters.to;
    }

    const limit = filters.limit || 100;
    const skip = ((filters.page || 1) - 1) * limit;
    const [data, total] = await Promise.all([
      this.logModel.find(query).sort({ date: -1 }).skip(skip).limit(limit).exec(),
      this.logModel.countDocuments(query).exec(),
    ]);
    return { data, total };
  }

  async getDeviceLogs(deviceId: string, limit = 50): Promise<LogDocument[]> {
    return this.logModel.find({ deviceId }).sort({ date: -1 }).limit(limit).exec();
  }

  async purgeOlderThan(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 86400 * 1000);
    const result = await this.logModel.deleteMany({ date: { $lt: cutoff } }).exec();
    return result.deletedCount;
  }
}
