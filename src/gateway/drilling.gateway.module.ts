import { Module } from '@nestjs/common';
import { DrillingGateway } from './drilling.gateway';
import { DrillingGatewayService } from './drilling.gateway.service';
import { DrillModule } from 'src/drills/drill.module';
import { DrillingSessionModule } from 'src/drills/drilling-session.module';
import { RedisModule } from 'src/common/redis.module';
import { OperatorModule } from 'src/operators/operator.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    DrillModule,
    DrillingSessionModule,
    RedisModule,
    AuthModule,
    OperatorModule,
  ],
  providers: [DrillingGateway, DrillingGatewayService],
  exports: [DrillingGatewayService, DrillingGateway], // Export DrillingGateway as well
})
export class DrillingGatewayModule {}
