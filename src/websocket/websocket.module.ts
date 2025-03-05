// src/websocket/websocket.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { DrillingCycleGateway } from './gateway/drilling-cycle.gateway';
import { DrillingSessionGateway } from './gateway/drilling-session.gateway';
import { DrillingSession, DrillingSessionSchema } from '../drills/schemas/drilling-session.schema';
import { NotificationGateway } from './gateway/notification.gateway';
import { ConnectionManagerService } from './services/connection-manager.service';
import { NotificationService } from './services/notification.service';
import { SchedulerBridgeService } from './services/scheduler-bridge.service';
import { DrillingCycleMockService } from '../drills/drilling-cycle-mock.service';

@Module({
    imports: [
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'your-secret-key',
            signOptions: { expiresIn: '1d' },
        }),
        MongooseModule.forFeature([
            { name: DrillingSession.name, schema: DrillingSessionSchema }
        ])
    ],
    providers: [
        DrillingCycleGateway,
        NotificationGateway,
        DrillingSessionGateway,

        DrillingCycleMockService,
        NotificationService,
        ConnectionManagerService,
        SchedulerBridgeService,
    ],
    exports: [
        DrillingCycleGateway,
        DrillingSessionGateway,
        NotificationService,
        SchedulerBridgeService,
    ],
})
export class WebSocketModule { }