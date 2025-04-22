import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import {
  TelegramChannelMember,
  TelegramChannelMemberSchema,
} from './schemas/telegram-channel-member.schema';
import {
  TelegramWebhook,
  TelegramWebhookSchema,
} from './schemas/telegram-webhook.schema';
import { HttpModule } from '@nestjs/axios';
import { OperatorModule } from 'src/operators/operator.module';
import { ReferralModule } from 'src/referral/referral.module';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    OperatorModule,
    ReferralModule,
    MongooseModule.forFeature([
      { name: TelegramChannelMember.name, schema: TelegramChannelMemberSchema },
      { name: TelegramWebhook.name, schema: TelegramWebhookSchema },
    ]),
  ],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
