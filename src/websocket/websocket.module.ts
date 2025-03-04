// src/websocket/websocket.module.ts
import { Module } from '@nestjs/common';
import { DrillingCycleGateway } from './drilling-cycle.websocket';
import { DrillingCycleMockService } from '../drills/drilling-cycle-mock.service';

@Module({
    providers: [DrillingCycleGateway, DrillingCycleMockService],
    exports: [DrillingCycleGateway],
})
export class WebSocketModule { }