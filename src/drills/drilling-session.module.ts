import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import {
  DrillingSession,
  DrillingSessionSchema,
} from './schemas/drilling-session.schema';
import { DrillingSessionService } from './drilling-session.service';
import { OperatorModule } from 'src/operators/operator.module';
import { RedisModule } from 'src/common/redis.module';

@Module({
  imports: [
    ConfigModule, // Load environment variables
    RedisModule, // Import the RedisModule
    OperatorModule, // Import the OperatorModule
    MongooseModule.forFeature([
      { name: DrillingSession.name, schema: DrillingSessionSchema },
    ]),
  ],
  controllers: [],
  providers: [DrillingSessionService],
  exports: [DrillingSessionService], // Export so other modules can use DrillingCycleService
})
export class DrillingSessionModule {}
