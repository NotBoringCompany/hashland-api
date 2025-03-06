import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DrillingSession } from './schemas/drilling-session.schema';
import { Model, Types } from 'mongoose';

@Injectable()
export class DrillingSessionService {
  constructor(
    @InjectModel(DrillingSession.name)
    private drillingSessionModel: Model<DrillingSession>,
  ) {}

  /**
   * Fetches the total number of active drilling sessions from the database.
   */
  async fetchActiveDrillingSessions(): Promise<number> {
    return this.drillingSessionModel.countDocuments({ endTime: null });
  }

  /**
   * Fetches the operator IDs from all active drilling sessions.
   */
  async fetchActiveDrillingSessionOperatorIds(): Promise<Types.ObjectId[]> {
    return this.drillingSessionModel
      .find({ endTime: null })
      .distinct('operatorId')
      .lean();
  }
}
