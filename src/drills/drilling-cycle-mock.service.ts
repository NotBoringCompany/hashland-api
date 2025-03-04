// src/services/drilling-cycle-mock.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { DrillingCycleGateway } from '../websocket/drilling-cycle.websocket';

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
    private currentCycle: number = 0;
    private cycleInterval: NodeJS.Timeout;

    constructor(private readonly drillingCycleGateway: DrillingCycleGateway) { }

    onModuleInit() {
        this.startCycleMockData();
    }

    private startCycleMockData() {
        // Generate cycle update every second
        this.cycleInterval = setInterval(() => {
            const mockData = this.generateMockCycleData();
            this.drillingCycleGateway.sendCycleUpdate(mockData);
        }, 1000);
    }

    private generateMockCycleData(): CycleData {
        this.currentCycle = (this.currentCycle + 1) % 100; // Progress from 0 to 100

        return {
            cycleId: `cycle-${Date.now()}`,
            timestamp: Math.floor(Date.now() / 1000),
            activeOperators: Math.floor(Math.random() * 100) + 50, // Random number between 50-150
            totalHashMined: Math.floor(Math.random() * 1000),
            cycleProgress: this.currentCycle,
            topMiners: Array(5).fill(null).map((_, index) => ({
                operatorId: `operator-${index + 1}`,
                hashMined: Math.floor(Math.random() * 100),
            })),
        };
    }

    // Clean up on application shutdown
    onApplicationShutdown() {
        if (this.cycleInterval) {
            clearInterval(this.cycleInterval);
        }
    }
}