import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  HttpStatus,
  UseGuards,
  Logger,
  ValidationPipe,
  HttpCode,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt/jwt-auth.guard';
import { AdminGuard } from 'src/auth/admin/admin.guard';
import { NotificationService } from '../services/notification.service';
import { NotificationDispatcherService } from '../services/notification-dispatcher.service';
import { NotificationAnalyticsService } from '../services/notification-analytics.service';
import {
  CreateNotificationDto,
  CreateBulkNotificationDto,
} from '../dto/create-notification.dto';
import { ApiResponse } from '../../common/dto/response.dto';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { Types } from 'mongoose';
import { Notification } from '../schemas/notification.schema';
import {
  NotificationAnalyticsResponseDto,
  DeliveryStatsResponseDto,
  EngagementMetricsResponseDto,
} from '../dto/analytics-response.dto';

/**
 * DTO for broadcast notification
 */
export class BroadcastNotificationDto {
  notification: CreateNotificationDto;
  userIds: string[];
  templateId?: string;
  templateContext?: any;
  batchSize?: number;
}

/**
 * DTO for admin notification filters
 */
export class AdminNotificationFilterDto {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  type?: string;
  priority?: string;
  isRead?: boolean;
  includeRead?: boolean;
  userId?: string;
  senderId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Admin controller for notification management and system operations
 */
@ApiTags('Admin Notifications')
@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class NotificationAdminController {
  private readonly logger = new Logger(NotificationAdminController.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly dispatcherService: NotificationDispatcherService,
    private readonly analyticsService: NotificationAnalyticsService,
  ) {}

  /**
   * Get all notifications with admin filters
   */
  @Get()
  @ApiOperation({
    summary: 'Get all notifications (Admin)',
    description: 'Retrieve all notifications with advanced admin filtering',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: String,
    example: '507f1f77bcf86cd799439012',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    type: String,
    example: 'system_alert',
  })
  @ApiQuery({
    name: 'priority',
    required: false,
    type: String,
    example: 'critical',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    type: String,
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    type: String,
    example: '2024-12-31',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
    type: PaginatedResponse.withType(Notification),
  })
  async getAllNotifications(
    @Query() filterDto: AdminNotificationFilterDto,
  ): Promise<
    PaginatedResponse<Notification> | ApiResponse<{ message: string }>
  > {
    try {
      // For admin, we need to get notifications for a specific user if provided
      const userId = filterDto.userId
        ? new Types.ObjectId(filterDto.userId)
        : null;

      if (userId) {
        // Convert admin filter to proper service filter format
        const serviceFilter = {
          page: filterDto.page,
          limit: filterDto.limit,
          sortBy: filterDto.sortBy,
          sortOrder: filterDto.sortOrder,
          type: filterDto.type as any,
          priority: filterDto.priority as any,
          isRead: filterDto.isRead,
          includeRead: filterDto.includeRead,
        };

        const result = await this.notificationService.findAll(
          userId,
          serviceFilter,
        );
        this.logger.log(
          `Admin retrieved ${result.notifications.length} notifications for user ${userId}`,
        );

        return new PaginatedResponse(
          HttpStatus.OK,
          'Notifications retrieved successfully',
          {
            items: result.notifications,
            page: result.page,
            limit: filterDto.limit || 50,
            total: result.total,
          },
        );
      } else {
        // TODO: Implement admin-level notification retrieval across all users
        this.logger.warn(
          'Admin notification retrieval across all users not yet implemented',
        );

        return new ApiResponse(
          HttpStatus.OK,
          'Admin-level cross-user notification retrieval not yet implemented. Please specify userId.',
          {
            message:
              'Please specify userId parameter for notification retrieval',
          },
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to get notifications for admin: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Create system notification
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create system notification',
    description: 'Create a system notification to a specific user',
  })
  @ApiBody({ type: CreateNotificationDto })
  @SwaggerApiResponse({
    status: 201,
    description: 'System notification created successfully',
    type: ApiResponse,
  })
  async createSystemNotification(
    @Body() createDto: CreateNotificationDto,
  ): Promise<ApiResponse<{ jobId: string; recipientId: string }>> {
    try {
      const jobId = await this.dispatcherService.sendNotification(createDto);

      this.logger.log(
        `Admin created system notification for user ${createDto.recipientId}, job ID: ${jobId}`,
      );

      return new ApiResponse(
        HttpStatus.CREATED,
        'System notification created successfully',
        {
          jobId,
          recipientId: createDto.recipientId.toString(),
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to create system notification: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Send bulk notifications
   */
  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send bulk notifications',
    description:
      'Send notifications to multiple users based on targeting criteria',
  })
  @ApiBody({ type: CreateBulkNotificationDto })
  @SwaggerApiResponse({
    status: 201,
    description: 'Bulk notifications initiated successfully',
    type: ApiResponse,
  })
  async sendBulkNotifications(
    @Body() bulkDto: CreateBulkNotificationDto,
  ): Promise<
    ApiResponse<{ created: number; failed: number; notifications: string[] }>
  > {
    try {
      const result = await this.notificationService.createBulk(bulkDto);

      this.logger.log(
        `Admin initiated bulk notifications: ${result.created} successful, ${result.failed} failed`,
      );

      return new ApiResponse(
        HttpStatus.CREATED,
        `Bulk notifications initiated: ${result.created} successful, ${result.failed} failed`,
        {
          created: result.created,
          failed: result.failed,
          notifications: result.notifications.map((n) => n._id.toString()),
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to send bulk notifications: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Broadcast notification to multiple users
   */
  @Post('broadcast')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Broadcast notification',
    description: 'Send the same notification to multiple specific users',
  })
  @ApiBody({ type: BroadcastNotificationDto })
  @SwaggerApiResponse({
    status: 201,
    description: 'Broadcast notification initiated successfully',
    type: ApiResponse,
  })
  async broadcastNotification(
    @Body() broadcastDto: BroadcastNotificationDto,
  ): Promise<
    ApiResponse<{ jobId: string; userCount: number; batchSize: number }>
  > {
    try {
      const userIds = broadcastDto.userIds.map((id) => new Types.ObjectId(id));

      const jobId = await this.dispatcherService.sendBroadcastNotification(
        broadcastDto.notification,
        userIds,
        broadcastDto.templateId,
        broadcastDto.templateContext,
        {
          batchSize: broadcastDto.batchSize || 100,
        },
      );

      this.logger.log(
        `Admin initiated broadcast notification to ${userIds.length} users, job ID: ${jobId}`,
      );

      return new ApiResponse(
        HttpStatus.CREATED,
        `Broadcast notification initiated to ${userIds.length} users`,
        {
          jobId,
          userCount: userIds.length,
          batchSize: broadcastDto.batchSize || 100,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to broadcast notification: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete notification (admin)
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete notification (Admin)',
    description: 'Delete any notification by ID (admin operation)',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    name: 'userId',
    required: true,
    type: String,
    description: 'User ID who owns the notification',
    example: '507f1f77bcf86cd799439012',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
    type: ApiResponse,
  })
  async deleteNotification(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ): Promise<ApiResponse<null>> {
    try {
      const notificationId = new Types.ObjectId(id);
      const userObjectId = new Types.ObjectId(userId);

      await this.notificationService.delete(notificationId, userObjectId);

      this.logger.log(`Admin deleted notification ${id} for user ${userId}`);
      return new ApiResponse(
        HttpStatus.OK,
        'Notification deleted successfully',
        null,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete notification ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get notification analytics
   */
  @Get('analytics')
  @ApiOperation({
    summary: 'Get notification analytics',
    description: 'Retrieve comprehensive notification analytics and metrics',
  })
  @ApiQuery({ name: 'period', required: false, type: String, example: '7d' })
  @ApiQuery({ name: 'notificationType', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @SwaggerApiResponse({
    status: 200,
    description: 'Analytics retrieved successfully',
    type: ApiResponse.withType(NotificationAnalyticsResponseDto),
  })
  async getNotificationAnalytics(
    @Query('period') period?: string,
    @Query('notificationType') notificationType?: string,
    @Query('userId') userId?: string,
  ): Promise<ApiResponse<NotificationAnalyticsResponseDto>> {
    try {
      // Build filters from query parameters
      const filters: any = {};

      if (userId) {
        filters.userId = new Types.ObjectId(userId);
      }

      if (notificationType) {
        filters.notificationType = notificationType;
      }

      if (period) {
        const days = parseInt(period.replace('d', '')) || 7;
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - days);
        filters.dateFrom = dateFrom;
        filters.dateTo = new Date();
      }

      const analyticsData =
        await this.analyticsService.getAnalyticsSummary(filters);

      // Map service response to DTO
      const analytics: NotificationAnalyticsResponseDto = {
        totalNotifications: analyticsData.totalNotifications || 0,
        totalDelivered: analyticsData.totalNotifications || 0,
        totalFailed: 0,
        totalRead: 0,
        totalClicks: analyticsData.totalClicks || 0,
        totalConversions: analyticsData.totalConversions || 0,
        totalImpressions: analyticsData.totalImpressions || 0,
        deliveryRate: 100,
        readRate: 0,
        clickRate: analyticsData.averageClickThroughRate || 0,
        conversionRate: analyticsData.averageConversionRate || 0,
        byType: {},
        byPriority: {},
        generatedAt: new Date().toISOString(),
        periodStart: filters.dateFrom?.toISOString(),
        periodEnd: filters.dateTo?.toISOString(),
      };

      this.logger.log('Retrieved notification analytics');
      return new ApiResponse(
        HttpStatus.OK,
        'Analytics retrieved successfully',
        analytics,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get analytics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get delivery statistics
   */
  @Get('delivery-stats')
  @ApiOperation({
    summary: 'Get delivery statistics',
    description: 'Retrieve notification delivery statistics and metrics',
  })
  @ApiQuery({ name: 'period', required: false, type: String, example: '7d' })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @SwaggerApiResponse({
    status: 200,
    description: 'Delivery statistics retrieved successfully',
    type: ApiResponse.withType(DeliveryStatsResponseDto),
  })
  async getDeliveryStats(
    @Query('period') period?: string,
    @Query('userId') userId?: string,
  ): Promise<ApiResponse<DeliveryStatsResponseDto>> {
    try {
      // Build filters from query parameters
      const filters: any = {};

      if (userId) {
        filters.userId = new Types.ObjectId(userId);
      }

      const days = period ? parseInt(period.replace('d', '')) || 7 : 7;
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);
      filters.dateFrom = dateFrom;
      filters.dateTo = new Date();

      const statsData =
        await this.analyticsService.getAnalyticsSummary(filters);

      // Map service response to DTO
      const deliveryStats: DeliveryStatsResponseDto = {
        period: period || 'Last 7 days',
        dateFrom: dateFrom.toISOString(),
        dateTo: new Date().toISOString(),
        totalNotifications: statsData.totalNotifications || 0,
        totalDelivered: statsData.totalNotifications || 0,
        totalFailed: 0,
        totalPending: 0,
        deliveryRate: 100,
        failureRate: 0,
        avgDeliveryTime: 0,
        dailyStats: [],
        byChannel: { websocket: statsData.totalNotifications || 0 },
      };

      this.logger.log('Retrieved delivery statistics');
      return new ApiResponse(
        HttpStatus.OK,
        'Delivery statistics retrieved successfully',
        deliveryStats,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get delivery stats: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get user engagement metrics
   */
  @Get('engagement')
  @ApiOperation({
    summary: 'Get user engagement metrics',
    description: 'Retrieve user engagement metrics for notifications',
  })
  @ApiQuery({ name: 'period', required: false, type: String, example: '30d' })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @SwaggerApiResponse({
    status: 200,
    description: 'Engagement metrics retrieved successfully',
    type: ApiResponse.withType(EngagementMetricsResponseDto),
  })
  async getEngagementMetrics(
    @Query('period') period?: string,
    @Query('userId') userId?: string,
  ): Promise<ApiResponse<EngagementMetricsResponseDto>> {
    try {
      // Build filters from query parameters
      const filters: any = {};

      if (userId) {
        filters.userId = new Types.ObjectId(userId);
      }

      const days = period ? parseInt(period.replace('d', '')) || 30 : 30;
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);
      filters.dateFrom = dateFrom;
      filters.dateTo = new Date();

      const metricsData =
        await this.analyticsService.getAnalyticsSummary(filters);

      // Calculate engagement metrics
      const engagementRate =
        metricsData.totalImpressions > 0
          ? ((metricsData.totalClicks + metricsData.totalConversions) /
              metricsData.totalImpressions) *
            100
          : 0;

      // Map service response to DTO
      const engagementMetrics: EngagementMetricsResponseDto = {
        period: period || 'Last 30 days',
        userId: userId || 'All users',
        engagementRate: Math.round(engagementRate * 100) / 100,
        totalNotifications: metricsData.totalNotifications || 0,
        totalImpressions: metricsData.totalImpressions || 0,
        totalRead: 0,
        totalClicks: metricsData.totalClicks || 0,
        totalConversions: metricsData.totalConversions || 0,
        impressionRate:
          metricsData.totalNotifications > 0
            ? (metricsData.totalImpressions / metricsData.totalNotifications) *
              100
            : 0,
        readRate: 0,
        clickThroughRate: metricsData.averageClickThroughRate || 0,
        conversionRate: metricsData.averageConversionRate || 0,
        avgTimeToRead: 0,
        avgTimeToClick: 0,
        dailyEngagement: [],
        engagementByType: {},
      };

      this.logger.log('Retrieved engagement metrics');
      return new ApiResponse(
        HttpStatus.OK,
        'Engagement metrics retrieved successfully',
        engagementMetrics,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get engagement metrics: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Send test notification with template
   */
  @Post('test-template')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send test notification with template',
    description: 'Send a test notification using a specific template',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        templateId: { type: 'string', example: '507f1f77bcf86cd799439015' },
        recipientId: { type: 'string', example: '507f1f77bcf86cd799439012' },
        templateContext: {
          type: 'object',
          example: { userName: 'John Doe', amount: 250 },
        },
        priority: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low'],
          example: 'high',
        },
      },
      required: ['templateId', 'recipientId'],
    },
  })
  @SwaggerApiResponse({
    status: 201,
    description: 'Test notification with template sent successfully',
    type: ApiResponse,
  })
  async sendTestNotificationWithTemplate(
    @Body()
    body: {
      templateId: string;
      recipientId: string;
      templateContext?: any;
      priority?: string;
    },
  ): Promise<
    ApiResponse<{
      jobId: string;
      templateId: string;
      recipientId: string;
      templateContext?: any;
    }>
  > {
    try {
      const { templateId, recipientId, templateContext, priority } = body;

      // Create a basic notification DTO for template testing
      const baseNotification: CreateNotificationDto = {
        type: 'custom' as any,
        priority: (priority as any) || 'medium',
        recipientId: new Types.ObjectId(recipientId),
        content: {
          type: 'template' as any,
          data: {
            title: 'Template Test',
            message: 'This is a template test notification',
          },
        },
      };

      const jobId = await this.dispatcherService.sendNotification(
        baseNotification,
        templateId,
        templateContext,
      );

      this.logger.log(
        `Admin sent test notification with template ${templateId} to user ${recipientId}, job ID: ${jobId}`,
      );

      return new ApiResponse(
        HttpStatus.CREATED,
        'Test notification with template sent successfully',
        {
          jobId,
          templateId,
          recipientId,
          templateContext,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to send test notification with template: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
