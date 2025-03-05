import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DrillingCycleGateway } from '../websocket/gateway/drilling-cycle.gateway';
import { SchedulerBridgeService } from '../websocket/services/scheduler-bridge.service';

interface CycleData {
  cycleId: string;
  timestamp: number;
  activeOperators: number;
  totalHashMined: number;
  cycleProgress: number;
}

@Injectable()
export class DrillingCycleMockService implements OnModuleInit {
  private readonly logger = new Logger(DrillingCycleMockService.name);
  private currentCycle: number = 0;
  private cycleInterval: NodeJS.Timeout;

  constructor(
    private readonly drillingCycleGateway: DrillingCycleGateway,
    private readonly schedulerBridgeService: SchedulerBridgeService,
  ) {}

  onModuleInit() {
    this.startCycleMockData();
  }

  private startCycleMockData() {
    this.logger.log('Starting mock data generation...');

    this.cycleInterval = setInterval(() => {
      const mockData = this.generateMockCycleData();

      // Send via WebSocket gateway
      this.drillingCycleGateway.sendCycleUpdate(mockData);

      // Also process through the notification system
      this.schedulerBridgeService.processCycleUpdate(mockData);

      // Simulate cycle completion when reaching 100%
      if (mockData.cycleProgress === 100) {
        this.schedulerBridgeService.processCycleCompletion(mockData);
      }
    }, 5000); // Update every 5 seconds
  }

  private generateMockCycleData(): CycleData {
    this.currentCycle = (this.currentCycle + 5) % 105; // 0-100 with 5% increments

    return {
      cycleId: `cycle-${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000),
      activeOperators: Math.floor(Math.random() * 20) + 5,
      totalHashMined: Math.floor(Math.random() * 1000000),
      cycleProgress: this.currentCycle,
    };
  }

  onApplicationShutdown() {
    if (this.cycleInterval) {
      clearInterval(this.cycleInterval);
      this.logger.log('Stopped mock data generation');
    }
  }
}
