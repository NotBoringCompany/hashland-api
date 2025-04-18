import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ReferralService } from './referral.service';
import { Referral, ReferralSchema } from './schemas/referral.schema';
import {
  Operator,
  OperatorSchema,
} from 'src/operators/schemas/operator.schema';
import { RedisModule } from 'src/common/redis.module';

@Module({
  imports: [
    ConfigModule,
    RedisModule,
    MongooseModule.forFeature([
      { name: Referral.name, schema: ReferralSchema },
      { name: Operator.name, schema: OperatorSchema },
    ]),
  ],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}
