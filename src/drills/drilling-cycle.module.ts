import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DrillingCycleService } from './drilling-cycle.service';
import { DrillingCycleQueue } from './drilling-cycle.queue';
import {
  DrillingCycle,
  DrillingCycleSchema,
} from './schemas/drilling-cycle.schema';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { DrillingCycleController } from './drilling-cycle.controller';

@Module({
  imports: [
    ConfigModule, // Load environment variables
    MongooseModule.forFeature([
      { name: DrillingCycle.name, schema: DrillingCycleSchema },
    ]),
    BullModule.registerQueue({ name: 'drilling-cycles' }), // Register Bull queue
  ],
  controllers: [DrillingCycleController],
  providers: [DrillingCycleService, DrillingCycleQueue],
  exports: [DrillingCycleService], // Export so other modules can use DrillingCycleService
})
export class DrillingCycleModule {}
