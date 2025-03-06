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

  /**
   * Fetches all active drilling sessions with drill ID and its actual EFF from the `Drill` collection.
   */
  async fetchActiveDrillingSessionsWithEff(): Promise<
    { drillId: Types.ObjectId; eff: number }[]
  > {
    const activeSessions = await this.drillingSessionModel.aggregate([
      {
        $match: { endTime: null }, // Only active drilling sessions
      },
      {
        $lookup: {
          from: 'Drills', // Collection name (case-sensitive)
          localField: 'drillId',
          foreignField: '_id',
          as: 'drill',
        },
      },
      {
        $unwind: '$drill', // Flatten the drill data
      },
      {
        $match: { 'drill.extractorAllowed': true }, // Ensure only valid drills are selected
      },
      {
        $project: {
          drillId: '$drill._id',
          eff: '$drill.actualEff',
        },
      },
    ]);

    return activeSessions;
  }
}
