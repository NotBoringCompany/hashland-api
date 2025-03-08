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

  /**
   * Sends real-time updates to all connected WebSocket clients.
   */
  async sendRealTimeUpdates() {
    const currentCycleNumber =
      await this.drillingCycleService.getCurrentCycleNumber();

    const onlineOperators = this.drillingGateway.getOnlineOperatorCount();

    // Fetch issued HASH from Redis
    const issuedHASHStr = await this.redisService.get(
      `drilling-cycle:${currentCycleNumber}:issuedHASH`,
    );
    const issuedHASH = issuedHASHStr ? parseInt(issuedHASHStr, 10) : 0;

    // Fetch total EFF and drilling difficulty
    const operatorEffData =
      await this.drillService.batchCalculateTotalEffAndDrillingDifficulty();

    this.drillingGateway.server.emit('drilling-update', {
      currentCycleNumber,
      onlineOperatorCount: onlineOperators,
      issuedHASH,
      operatorEffData,
    });

    this.logger.log(`📡 Sent real-time drilling updates.`);
  }
}
