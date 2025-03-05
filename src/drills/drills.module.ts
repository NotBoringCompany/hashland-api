// src/drills/drills.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  DrillingCycle,
  DrillingCycleSchema,
} from './schemas/drilling-cycle.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DrillingCycle.name, schema: DrillingCycleSchema },
    ]),
  ],
})
export class DrillsModule {}
