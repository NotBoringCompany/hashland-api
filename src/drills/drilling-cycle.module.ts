import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DrillingCycleService } from './drilling-cycle.service';
import { DrillingCycleQueue } from './drilling-cycle.queue';
import {
  DrillingCycle,
  DrillingCycleSchema,
} from './schemas/drilling-cycle.schema';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DrillingCycle.name, schema: DrillingCycleSchema },
    ]),
    BullModule.registerQueue({ name: 'drilling-cycles' }), // Register Bull queue
  ],
  providers: [DrillingCycleService, DrillingCycleQueue],
  exports: [DrillingCycleService], // Export so other modules can use DrillingCycleService
})
export class DrillingCycleModule {}
