import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationService } from './services/notification.service';
import { NotificationTemplateService } from './services/notification-template.service';
import { NotificationTemplateEngineService } from './services/notification-template-engine.service';
import { NotificationGatewayService } from './services/notification-gateway.service';
import { NotificationAnalyticsService } from './services/notification-analytics.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { NotificationDispatcherService } from './services/notification-dispatcher.service';
import { NotificationQueueMonitorService } from './services/notification-queue-monitor.service';
import { NotificationGateway } from './gateways/notification.gateway';
import { NotificationProcessor } from './processors/notification.processor';
import { NotificationTemplateAdminController } from './controllers/notification-template-admin.controller';
import { NotificationQueueAdminController } from './controllers/notification-queue-admin.controller';
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
 * Notification module with comprehensive notification system including queue processing
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
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),
    ScheduleModule.forRoot(),
    RedisModule,
  ],
  controllers: [
    NotificationTemplateAdminController,
    NotificationQueueAdminController,
  ],
  providers: [
    NotificationService,
    NotificationTemplateService,
    NotificationTemplateEngineService,
    NotificationGateway,
    NotificationGatewayService,
    NotificationAnalyticsService,
    NotificationPreferenceService,
    NotificationDispatcherService,
    NotificationQueueMonitorService,
    NotificationProcessor,
  ],
  exports: [
    NotificationService,
    NotificationTemplateService,
    NotificationTemplateEngineService,
    NotificationGatewayService,
    NotificationAnalyticsService,
    NotificationPreferenceService,
    NotificationDispatcherService,
    NotificationQueueMonitorService,
  ],
})
export class NotificationModule {}
