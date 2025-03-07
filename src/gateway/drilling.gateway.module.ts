import { Module } from '@nestjs/common';
import { DrillingGateway } from './drilling.gateway';
import { DrillingGatewayService } from './drilling.gateway.service';
import { DrillModule } from 'src/drills/drill.module';
import { DrillingSessionModule } from 'src/drills/drilling-session.module';
import { DrillingCycleModule } from 'src/drills/drilling-cycle.module';
import { RedisModule } from 'src/common/redis.module';

@Module({
  imports: [
    DrillModule,
    DrillingSessionModule,
    DrillingCycleModule,
    RedisModule,
  ],
  providers: [DrillingGateway, DrillingGatewayService],
  exports: [DrillingGatewayService], // ✅ Export so other modules can use it
})
export class DrillingGatewayModule {}
