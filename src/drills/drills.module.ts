// src/drills/drills.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  DrillingCycle,
  DrillingCycleSchema,
} from './schemas/drilling-cycle.schema';
import { ExtractorSelectionService } from './services/extractor-selection.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DrillingCycle.name, schema: DrillingCycleSchema },
    ]),
  ],
  providers: [ExtractorSelectionService],
  exports: [ExtractorSelectionService],
})
export class DrillsModule {}
