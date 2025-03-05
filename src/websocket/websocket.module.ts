import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { DrillingCycleGateway } from './gateway/drilling-cycle.gateway';
import { DrillingSessionGateway } from './gateway/drilling-session.gateway';
import {
  DrillingSession,
  DrillingSessionSchema,
} from '../drills/schemas/drilling-session.schema';
import { NotificationGateway } from './gateway/notification.gateway';
import { ConnectionManagerService } from './services/connection-manager.service';
import { NotificationService } from './services/notification.service';
import { SchedulerBridgeService } from './services/scheduler-bridge.service';
// import { DrillingCycleMockService } from '../drills/drilling-cycle-mock.service';

@Module({
  imports: [
    AuthModule, // Import AuthModule instead of JwtModule
    MongooseModule.forFeature([
      { name: DrillingSession.name, schema: DrillingSessionSchema },
    ]),
  ],
  providers: [
    DrillingCycleGateway,
    NotificationGateway,
    DrillingSessionGateway,

    // DrillingCycleMockService,
    NotificationService,
    ConnectionManagerService,
    SchedulerBridgeService,
  ],
  exports: [
    DrillingCycleGateway,
    DrillingSessionGateway,
    NotificationService,
    ConnectionManagerService,
    SchedulerBridgeService,
  ],
})
export class WebSocketModule { }
