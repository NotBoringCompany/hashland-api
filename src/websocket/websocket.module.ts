// src/websocket/websocket.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DrillingCycleGateway } from './gateway/drilling-cycle.gateway';
import { DrillingSessionGateway } from './gateway/drilling-session.gateway';
import { DrillingSession, DrillingSessionSchema } from '../drills/schemas/drilling-session.schema';
import { DrillingCycleMockService } from '../drills/drilling-cycle-mock.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: DrillingSession.name, schema: DrillingSessionSchema }
        ])
    ],
    providers: [DrillingCycleGateway, DrillingCycleMockService, DrillingSessionGateway],
    exports: [DrillingCycleGateway, DrillingSessionGateway],
})
export class WebSocketModule { }