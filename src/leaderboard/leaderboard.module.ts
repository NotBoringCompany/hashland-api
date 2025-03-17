import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Operator,
  OperatorSchema,
} from 'src/operators/schemas/operator.schema';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardController } from './leaderboard.controller';
import { PoolOperator, PoolOperatorSchema } from 'src/pools/schemas/pool-operator.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Operator.name, schema: OperatorSchema },
      { name: PoolOperator.name, schema: PoolOperatorSchema },
    ]),
  ],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService], // ✅ Allow use in other modules
})
export class LeaderboardModule {}
