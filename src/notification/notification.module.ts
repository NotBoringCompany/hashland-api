import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { NotificationService } from './services/notification.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { NotificationGatewayService } from './services/notification-gateway.service';
import { NotificationAnalyticsService } from './services/notification-analytics.service';
import { NotificationGateway } from './gateways/notification.gateway';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import {
  NotificationTemplate,
  NotificationTemplateSchema,
} from './schemas/notification-template.schema';
import {
  NotificationPreference,
  NotificationPreferenceSchema,
} from './schemas/notification-preference.schema';
import { RedisService } from 'src/common/redis.service';

/**
 * Notification module providing comprehensive notification system
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: NotificationTemplate.name, schema: NotificationTemplateSchema },
      {
        name: NotificationPreference.name,
        schema: NotificationPreferenceSchema,
      },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [
    NotificationService,
    NotificationPreferenceService,
    NotificationGatewayService,
    NotificationAnalyticsService,
    NotificationGateway,
    RedisService,
  ],
  exports: [
    NotificationService,
    NotificationPreferenceService,
    NotificationGatewayService,
    NotificationAnalyticsService,
    NotificationGateway,
  ],
})
export class NotificationModule {}
