// src/drills/services/drilling-cycle.service.ts

import { Injectable } from '@nestjs/common';
import { ExtractorSelectionService } from './extractor-selection.service';

@Injectable()
export class DrillingCycleService {
    constructor(
        private readonly extractorSelectionService: ExtractorSelectionService,
    ) { }

    async completeCycle(cycleId: string) {
        // Your existing cycle completion logic...

        // Select extractor at the end of the cycle
        await this.extractorSelectionService.selectExtractorForCycle(cycleId);
    }
}