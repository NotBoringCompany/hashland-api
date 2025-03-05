import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DrillingCycleGateway } from '../websocket/gateway/drilling-cycle.gateway';

interface CycleData {
    cycleId: string;
    timestamp: number;
    activeOperators: number;
    totalHashMined: number;
    cycleProgress: number;
    topMiners: Array<{
        operatorId: string;
        hashMined: number;
    }>;
}

@Injectable()
export class DrillingCycleMockService implements OnModuleInit {
    private readonly logger = new Logger(DrillingCycleMockService.name);
    private currentCycle: number = 0;
    private cycleInterval: NodeJS.Timeout;

    constructor(private readonly drillingCycleGateway: DrillingCycleGateway) { }

    onModuleInit() {
        this.startCycleMockData();
    }

    private startCycleMockData() {
        this.logger.log('Starting mock data generation...');

        this.cycleInterval = setInterval(() => {
            const mockData = this.generateMockCycleData();
            this.drillingCycleGateway.sendCycleUpdate(mockData);
        }, 6000);
    }

    private generateMockCycleData(): CycleData {
        this.currentCycle = (this.currentCycle + 1) % 100;

        return {
            cycleId: `cycle-${Date.now()}`,
            timestamp: Math.floor(Date.now() / 1000),
            activeOperators: Math.floor(Math.random() * 100) + 50,
            totalHashMined: Math.floor(Math.random() * 1000),
            cycleProgress: this.currentCycle,
            topMiners: Array(5).fill(null).map((_, index) => ({
                operatorId: `operator-${index + 1}`,
                hashMined: Math.floor(Math.random() * 100),
            })),
        };
    }

    onApplicationShutdown() {
        if (this.cycleInterval) {
            clearInterval(this.cycleInterval);
            this.logger.log('Stopped mock data generation');
        }
    }
}