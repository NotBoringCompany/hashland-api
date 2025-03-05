import { Injectable } from '@nestjs/common';
import { ExtractorSelectionService } from './extractor-selection.service';
import { SchedulerBridgeService } from '../../websocket/services/scheduler-bridge.service';

@Injectable()
export class DrillingCycleService {
    constructor(
        private readonly extractorSelectionService: ExtractorSelectionService,
        private readonly schedulerBridgeService: SchedulerBridgeService,
    ) { }

    async completeCycle(cycleId: string) {
        // Select extractor at the end of the cycle
        await this.extractorSelectionService.selectExtractorForCycle(cycleId);

        // Get cycle completion data
        const cycleData = await this.getCycleCompletionData(cycleId);

        // Send notifications about cycle completion
        this.schedulerBridgeService.processCycleCompletion(cycleData);
    }

    private async getCycleCompletionData(cycleId: string) {
        // This is a placeholder - implement your actual data retrieval logic
        return {
            cycleId,
            timestamp: Math.floor(Date.now() / 1000),
            totalHashMined: 1000000, // Example value
            topMiners: [
                { operatorId: 'operator-1', hashMined: 50000 },
                { operatorId: 'operator-2', hashMined: 40000 },
                { operatorId: 'operator-3', hashMined: 30000 },
                { operatorId: 'operator-4', hashMined: 20000 },
                { operatorId: 'operator-5', hashMined: 10000 },
            ],
        };
    }
}