import { Injectable, Logger } from '@nestjs/common';
import { DrillingGateway } from './drilling.gateway';
import { DrillingCycleService } from 'src/drills/drilling-cycle.service';
import { DrillingSessionService } from 'src/drills/drilling-session.service';
import { RedisService } from 'src/common/redis.service';
import { DrillService } from 'src/drills/drill.service';

/**
 * Service for handling WebSocket interactions with the drilling gateway.
 */
@Injectable()
export class DrillingGatewayService {
  private readonly logger = new Logger(DrillingGatewayService.name);

  constructor(
    private readonly drillingGateway: DrillingGateway,
    private readonly drillingCycleService: DrillingCycleService,
    private readonly drillingSessionService: DrillingSessionService,
    private readonly redisService: RedisService,
    private readonly drillService: DrillService,
  ) {}

  async sendRealTimeUpdates() {
    // ✅ Fetch current cycle number & active operators from Redis
    const currentCycleNumber =
      await this.drillingCycleService.getCurrentCycleNumber();
    const activeOperators =
      await this.drillingSessionService.fetchActiveDrillingSessionsRedis();

    // ✅ Fetch issued HASH from Redis
    const issuedHASHStr = await this.redisService.get(
      `drilling-cycle:${currentCycleNumber}:issuedHASH`,
    );
    const issuedHASH = issuedHASHStr ? parseInt(issuedHASHStr, 10) : 0;

    // ✅ Fetch total EFF and drilling difficulty for all operators
    const operatorData =
      await this.drillService.batchCalculateTotalEffAndDrillingDifficulty();

    // ✅ Emit updates for each connected operator
    for (const [operatorId, { totalEff, drillingDifficulty }] of operatorData) {
      this.drillingGateway.server
        .to(operatorId.toString())
        .emit('drilling-update', {
          currentCycleNumber,
          activeOperatorCount: activeOperators,
          issuedHASH,
          drillingDifficulty,
          totalEff,
        });
    }

    this.logger.log(
      `📡 Sent real-time drilling updates to ${operatorData.size} operators.`,
    );
  }
}
