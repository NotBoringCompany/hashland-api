import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { DrillingSession } from './schemas/drilling-session.schema';
import { Model, Types } from 'mongoose';
import { RedisService } from 'src/common/redis.service';
import { ApiResponse } from 'src/common/dto/response.dto';
import { OperatorService } from 'src/operators/operator.service';

@Injectable()
export class DrillingSessionService {
  private readonly logger = new Logger(DrillingSessionService.name);
  private readonly redisActiveSessionsKey = 'drilling:activeSessionsCount';

  constructor(
    @InjectModel(DrillingSession.name)
    private drillingSessionModel: Model<DrillingSession>,
    private readonly redisService: RedisService,
    private readonly operatorService: OperatorService,
  ) {}

  /**
   * Creates a new `DrillingSession` instance.
   *
   * Called whenever an operator starts drilling for $HASH.
   */
  async startDrillingSession(
    operatorId: Types.ObjectId,
  ): Promise<ApiResponse<null>> {
    try {
      // Check if operator already has an active session
      const existingSession = await this.drillingSessionModel.exists({
        operatorId,
        endTime: null, // Active session
      });

      if (existingSession) {
        return new ApiResponse<null>(
          400,
          `(startDrillingSession) Operator already has an active drilling session.`,
        );
      }

      // Check if the operator's current fuel is enough.
      if (!(await this.operatorService.hasEnoughFuel(operatorId))) {
        return new ApiResponse<null>(
          400,
          `(startDrillingSession) Operator does not have enough fuel to start a drilling session.`,
        );
      }

      // Create a new drilling session
      await this.drillingSessionModel.create({
        operatorId,
        startTime: new Date(),
        earnedHASH: 0,
      });

      // Increment active session count in Redis
      await this.redisService.increment(this.redisActiveSessionsKey, 1);

      this.logger.log(
        `✅ (startDrillingSession) Operator ${operatorId} started drilling.`,
      );
      return new ApiResponse<null>(
        200,
        `(startDrillingSession) Drilling session started.`,
      );
    } catch (err: any) {
      return new ApiResponse<null>(
        500,
        `(startDrillingSession) Error starting drilling session: ${err.message}`,
      );
    }
  }

  /**
   * Ends the drilling session for an operator.
   */
  async endDrillingSession(
    operatorId: Types.ObjectId,
  ): Promise<ApiResponse<null>> {
    try {
      // ✅ Find active session
      const session = await this.drillingSessionModel.findOneAndUpdate(
        { operatorId, endTime: null },
        { endTime: new Date() }, // Mark session as ended
        { new: true },
      );

      if (!session) {
        return new ApiResponse<null>(
          400,
          `(endDrillingSession) No active session found for this operator.`,
        );
      }

      // ✅ Decrement active session count in Redis
      await this.redisService.increment(this.redisActiveSessionsKey, -1);

      this.logger.log(
        `🛑 (endDrillingSession) Operator ${operatorId} stopped drilling.`,
      );
      return new ApiResponse<null>(
        200,
        `(endDrillingSession) Drilling session stopped.`,
      );
    } catch (err: any) {
      return new ApiResponse<null>(
        500,
        `(endDrillingSession) Error ending drilling session: ${err.message}`,
      );
    }
  }

  /**
   * Fetches the total number of active drilling sessions from the database.
   */
  async fetchActiveDrillingSessions(): Promise<number> {
    return this.drillingSessionModel.countDocuments({ endTime: null });
  }

  /**
   * Fetches the total number of active drilling sessions from Redis.
   *
   * More efficient than `fetchActiveDrillingSessions`.
   */
  async fetchActiveDrillingSessionsRedis(): Promise<number> {
    const activeSessions = await this.redisService.get(
      this.redisActiveSessionsKey,
    );
    return activeSessions ? parseInt(activeSessions, 10) : 0;
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
