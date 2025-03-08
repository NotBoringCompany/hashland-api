import { Injectable, Logger } from '@nestjs/common';
import { DrillingGateway } from './drilling.gateway';
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
    private readonly redisService: RedisService,
    private readonly drillService: DrillService,
  ) {}

  /**
   * Sends real-time updates to all connected WebSocket clients.
   */
  async sendRealTimeUpdates() {
    // Directly fetch from Redis to prevent circular dependency with DrillingCycleService.
    const currentCycleNumberStr = await this.redisService.get(
      'drilling-cycle:current',
    );
    const currentCycleNumber = currentCycleNumberStr
      ? parseInt(currentCycleNumberStr, 10)
      : 0;

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
