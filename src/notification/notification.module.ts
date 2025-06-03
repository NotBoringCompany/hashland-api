import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { NotificationService } from './services/notification.service';
import { NotificationTemplateService } from './services/notification-template.service';
import { NotificationTemplateEngineService } from './services/notification-template-engine.service';
import { NotificationGatewayService } from './services/notification-gateway.service';
import { NotificationAnalyticsService } from './services/notification-analytics.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { NotificationGateway } from './gateways/notification.gateway';
import { NotificationTemplateAdminController } from './controllers/notification-template-admin.controller';
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
import { RedisModule } from 'src/common/redis.module';

/**
 * Notification module with comprehensive notification system
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
    BullModule.registerQueue({
      name: 'notification',
    }),
    RedisModule,
  ],
  controllers: [NotificationTemplateAdminController],
  providers: [
    NotificationService,
    NotificationTemplateService,
    NotificationTemplateEngineService,
    NotificationGateway,
    NotificationGatewayService,
    NotificationAnalyticsService,
    NotificationPreferenceService,
  ],
  exports: [
    NotificationService,
    NotificationTemplateService,
    NotificationTemplateEngineService,
    NotificationGatewayService,
    NotificationAnalyticsService,
    NotificationPreferenceService,
  ],
})
export class NotificationModule {}
