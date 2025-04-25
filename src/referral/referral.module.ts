import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ReferralService } from './referral.service';
import { Referral, ReferralSchema } from './schemas/referral.schema';
import { StarterCode, StarterCodeSchema } from './schemas/starter-code.schema';
import {
  Operator,
  OperatorSchema,
} from 'src/operators/schemas/operator.schema';
import { RedisModule } from 'src/common/redis.module';
import { ReferralController } from './referral.controller';

@Module({
  imports: [
    ConfigModule,
    RedisModule,
    MongooseModule.forFeature([
      { name: Referral.name, schema: ReferralSchema },
      { name: StarterCode.name, schema: StarterCodeSchema },
      { name: Operator.name, schema: OperatorSchema },
    ]),
  ],
  controllers: [ReferralController],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}
