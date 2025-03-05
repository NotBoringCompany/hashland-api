import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import {
  DrillingSession,
  DrillingSessionSchema,
} from './schemas/drilling-session.schema';
import { DrillingSessionService } from './drilling-session.service';

@Module({
  imports: [
    ConfigModule, // Load environment variables
    MongooseModule.forFeature([
      { name: DrillingSession.name, schema: DrillingSessionSchema },
    ]),
  ],
  controllers: [],
  providers: [DrillingSessionService],
  exports: [DrillingSessionService], // Export so other modules can use DrillingCycleService
})
export class DrillingSessionModule {}
