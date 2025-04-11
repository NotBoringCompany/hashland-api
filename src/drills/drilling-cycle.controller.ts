import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Param,
  Request,
} from '@nestjs/common';
import { DrillingCycleService } from './drilling-cycle.service';
import { RedisService } from 'src/common/redis.service';
import { DrillingGateway } from 'src/gateway/drilling.gateway';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { JwtAuthGuard } from 'src/auth/jwt/jwt-auth.guard';
import { ApiResponse } from 'src/common/dto/response.dto';

// Health check response types for type safety
interface ComponentStatus {
  status: 'ok' | 'error' | 'degraded';
}

interface HealthStatusDetails {
  redis: Record<string, any>;
  queue: Record<string, any>;
  gateway: Record<string, any>;
  currentCycle?: number | { error: string };
}

interface HealthStatusResponse {
  status: 'ok' | 'error' | 'degraded';
  timestamp: string;
  components: {
    redis: ComponentStatus;
    queue: ComponentStatus;
    gateway: ComponentStatus;
  };
  details: HealthStatusDetails;
}

@Controller('drilling-cycles')
export class DrillingCycleController {
  constructor(
    private readonly drillingCycleService: DrillingCycleService,
    private readonly redisService: RedisService,
    private readonly drillingGateway: DrillingGateway,
    @InjectQueue('drilling-cycles') private readonly drillingCycleQueue: Queue,
  ) {}

  /**
   * Checks if the issued HASH data is correct.
   */
  @Get('hash-check')
  async checkIssuedHASHData() {
    return this.drillingCycleService.checkIssuedHASHData();
  }

  /**
   * Returns the current drilling cycle status.
   */
  @Get('status')
  getCycleStatus() {
    return this.drillingCycleService.getCycleStatus();
  }

  /**
   * Fetches the latest drilling cycle number from Redis.
   */
  @Get('cycle-number')
  async getCurrentCycleNumber() {
    return this.drillingCycleService.getCurrentCycleNumber();
  }

  /**
   * Gets a cycle's extended data, such as the extractor-related data and reward share data.
   */
  @UseGuards(JwtAuthGuard)
  @Get(':cycleNumber/extended')
  async getCycleExtendedData(
    @Param('cycleNumber') cycleNumber: number,
    @Request() req,
  ): Promise<
    ApiResponse<{
      extractorOperatorUsername: string | null;
      extractorOperatorRewardShare: number;
      ownRewardShare: number;
    } | null>
  > {
    const operatorId = req.user.operatorId;
    return this.drillingCycleService.getCycleExtendedData(
      cycleNumber,
      operatorId,
    );
  }

  /**
   * Health check endpoint to monitor the status of the drilling system.
   * Verifies Redis connection, queue status, and gateway functionality.
   */
  @Get('health')
  async checkHealth(): Promise<HealthStatusResponse> {
    const healthStatus: HealthStatusResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      components: {
        redis: { status: 'ok' },
        queue: { status: 'ok' },
        gateway: { status: 'ok' },
      },
      details: {
        redis: {},
        queue: {},
        gateway: {},
      },
    };

    // Check Redis connection
    try {
      await this.redisService.set('health:check', 'ok', 10); // 10 second TTL
      const result = await this.redisService.get('health:check');

      if (result !== 'ok') {
        healthStatus.components.redis.status = 'error';
        healthStatus.status = 'degraded';
      }
    } catch (error) {
      healthStatus.components.redis.status = 'error';
      healthStatus.status = 'degraded';
      healthStatus.details.redis = { error: error.message };
    }

    // Check Bull Queue
    try {
      const queueInfo = await this.drillingCycleQueue.getJobCounts();
      healthStatus.details.queue = {
        jobs: queueInfo,
        isReady: !!this.drillingCycleQueue.client,
      };

      // Check repeatable jobs
      const repeatableJobs = await this.drillingCycleQueue.getRepeatableJobs();
      if (repeatableJobs.length === 0) {
        healthStatus.components.queue.status = 'error';
        healthStatus.status = 'degraded';
        healthStatus.details.queue.error = 'No repeatable jobs found';
      }
    } catch (error) {
      healthStatus.components.queue.status = 'error';
      healthStatus.status = 'degraded';
      healthStatus.details.queue = { error: error.message };
    }

    // Check Gateway
    try {
      const onlineCount = this.drillingGateway.getOnlineOperatorCount();
      const activeCount = this.drillingGateway.getActiveDrillingOperatorCount();

      healthStatus.details.gateway = {
        onlineOperators: onlineCount,
        activeOperators: activeCount,
        isReady: !!this.drillingGateway.server,
      };
    } catch (error) {
      healthStatus.components.gateway.status = 'error';
      healthStatus.status = 'degraded';
      healthStatus.details.gateway = { error: error.message };
    }

    // Add current cycle info
    try {
      const cycleInfo = await this.drillingCycleService.getCurrentCycleNumber();
      healthStatus.details.currentCycle = cycleInfo.data?.cycleNumber;
    } catch (error) {
      healthStatus.details.currentCycle = { error: error.message };
    }

    return healthStatus;
  }

  /**
   * Enables or disables the drilling cycle system.
   * Requires `ADMIN_PASSWORD` for security.
   */
  @Post('toggle')
  toggleCycles(@Body() body: { enabled: boolean; password: string }) {
    return this.drillingCycleService.toggleCycle(body.enabled, body.password);
  }

  /**
   * Resets the cycle number in Redis.
   */
  @Post('reset')
  async resetCycleNumber(
    @Body() body: { cycleNumber: number; password: string },
  ) {
    return await this.drillingCycleService.resetCycleNumber(
      body.cycleNumber,
      body.password,
    );
  }
}
