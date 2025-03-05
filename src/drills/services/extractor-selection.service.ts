// src/drills/services/extractor-selection.service.ts

import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DrillingCycle } from '../schemas/drilling-cycle.schema';
import { DrillConfig } from '../../common/enums/drill.enum';
import { ApiResponse } from '../../common/dto/response.dto';

@Injectable()
export class ExtractorSelectionService {
  private readonly logger = new Logger(ExtractorSelectionService.name);

  constructor(
    @InjectModel(DrillingCycle.name)
    private drillingCycleModel: Model<DrillingCycle>,
  ) {}

  async selectExtractorForCycle(
    cycleId: string,
  ): Promise<ApiResponse<{ extractorId: string }>> {
    try {
      const cycle = await this.drillingCycleModel
        .findById(cycleId)
        .populate('activeDrills')
        .lean();

      if (!cycle) {
        throw new Error(`Cycle ${cycleId} not found`);
      }

      const eligibleDrills = cycle.activeDrills.filter(
        (drill) => drill.config !== DrillConfig.BASIC,
      );

      if (eligibleDrills.length === 0) {
        throw new Error('No eligible drills found for extractor selection');
      }

      const totalEff = eligibleDrills.reduce(
        (sum, drill) => sum + drill.actualEff,
        0,
      );

      let accumulator = 0;
      const ranges = eligibleDrills.map((drill) => {
        const probability = drill.actualEff / totalEff;
        const range = {
          drillId: drill._id,
          start: accumulator,
          end: accumulator + probability,
        };
        accumulator += probability;
        return range;
      });

      const random = Math.random();
      const selectedRange = ranges.find(
        (range) => random >= range.start && random < range.end,
      );

      if (!selectedRange) {
        throw new Error('Failed to select extractor');
      }

      await this.drillingCycleModel.findByIdAndUpdate(cycleId, {
        extractorId: selectedRange.drillId,
      });

      this.logger.log(
        `Selected extractor ${selectedRange.drillId} for cycle ${cycleId}`,
      );

      return new ApiResponse<{ extractorId: string }>(
        200,
        'Extractor selected successfully',
        { extractorId: String(selectedRange.drillId) },
      );
    } catch (error) {
      this.logger.error(
        `Error selecting extractor for cycle ${cycleId}: ${error.message}`,
      );
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `Error selecting extractor: ${error.message}`,
        ),
      );
    }
  }
}
