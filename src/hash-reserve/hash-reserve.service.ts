import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HASHReserve } from './schemas/hash-reserve.schema';

@Injectable()
export class HashReserveService {
  private readonly logger = new Logger(HashReserveService.name);

  constructor(
    @InjectModel('HashReserve')
    private readonly hashReserveModel: Model<HASHReserve>,
  ) {}

  /**
   * Adds $HASH into the HASH Reserve.
   */
  async addToHASHReserve(amount: number): Promise<void> {
    if (amount <= 0) return;

    const result = await this.hashReserveModel.findOneAndUpdate(
      {},
      { $inc: { totalHASH: amount } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    this.logger.log(
      `✅ (addToHASHReserve) Added ${amount} $HASH to reserve. New total: ${result.totalHASH}`,
    );
  }

  /**
   * Fetches the current total HASH reserved.
   */
  async getTotalHASHReserved(): Promise<number> {
    const record = await this.hashReserveModel
      .findOne({}, { totalHASH: 1, _id: 0 })
      .lean();
    return record ? record.totalHASH : 0;
  }
}
