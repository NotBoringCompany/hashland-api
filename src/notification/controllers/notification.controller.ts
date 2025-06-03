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
  Request,
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
import { NotificationService } from '../services/notification.service';
import { NotificationAnalyticsService } from '../services/notification-analytics.service';
import { NotificationDispatcherService } from '../services/notification-dispatcher.service';
import {
  NotificationFilterDto,
  MarkNotificationsReadDto,
  UnreadCountDto,
} from '../dto/notification-filter.dto';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { ApiResponse } from '../../common/dto/response.dto';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { Types } from 'mongoose';
import { Notification } from '../schemas/notification.schema';

/**
 * Main notification controller for user-facing operations
 */
@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly analyticsService: NotificationAnalyticsService,
    private readonly dispatcherService: NotificationDispatcherService,
  ) {}

  /**
   * Get user notifications with filtering and pagination
   */
  @Get()
  @ApiOperation({
    summary: 'Get user notifications',
    description:
      'Retrieve user notifications with filtering, sorting, and pagination',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'type',
    required: false,
    type: String,
    example: 'auction_bid',
  })
  @ApiQuery({
    name: 'priority',
    required: false,
    type: String,
    example: 'high',
  })
  @ApiQuery({ name: 'isRead', required: false, type: Boolean, example: false })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    type: String,
    example: 'desc',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
    type: PaginatedResponse.withType(Notification),
  })
  async getUserNotifications(
    @Request() req: any,
    @Query() filterDto: NotificationFilterDto,
  ): Promise<PaginatedResponse<Notification>> {
    try {
      const userId = new Types.ObjectId(req.user.userId);
      const result = await this.notificationService.findAll(userId, filterDto);

      this.logger.log(
        `Retrieved ${result.notifications.length} notifications for user ${userId}`,
      );

      return new PaginatedResponse(
        HttpStatus.OK,
        'Notifications retrieved successfully',
        {
          items: result.notifications,
          page: result.page,
          limit: filterDto.limit || 20,
          total: result.total,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to get notifications for user ${req.user.userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get specific notification details
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get notification details',
    description: 'Retrieve detailed information about a specific notification',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    example: '507f1f77bcf86cd799439011',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Notification details retrieved successfully',
    type: ApiResponse.withType(Notification),
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Notification not found',
    type: ApiResponse,
  })
  async getNotification(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<ApiResponse<Notification>> {
    try {
      const userId = new Types.ObjectId(req.user.userId);
      const notificationId = new Types.ObjectId(id);

      const notification = await this.notificationService.findOne(
        notificationId,
        userId,
      );

      // Track impression when user views notification details
      await this.analyticsService.trackImpression(notificationId, userId);

      this.logger.log(`Retrieved notification ${id} for user ${userId}`);
      return new ApiResponse(
        HttpStatus.OK,
        'Notification details retrieved successfully',
        notification,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get notification ${id} for user ${req.user.userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Mark notifications as read
   */
  @Post('mark-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark notifications as read',
    description: 'Mark one or more notifications as read',
  })
  @ApiBody({ type: MarkNotificationsReadDto })
  @SwaggerApiResponse({
    status: 200,
    description: 'Notifications marked as read successfully',
    type: ApiResponse,
  })
  async markNotificationsAsRead(
    @Request() req: any,
    @Body() markReadDto: MarkNotificationsReadDto,
  ): Promise<
    ApiResponse<{ modifiedCount: number; notifications: Notification[] }>
  > {
    try {
      const userId = new Types.ObjectId(req.user.userId);
      const result = await this.notificationService.markAsRead(
        userId,
        markReadDto,
      );

      // Track read events for analytics
      for (const notification of result.notifications) {
        await this.analyticsService.trackRead(notification._id, userId);
      }

      this.logger.log(
        `Marked ${result.modifiedCount} notifications as read for user ${userId}`,
      );

      return new ApiResponse(
        HttpStatus.OK,
        `Marked ${result.modifiedCount} notifications as read`,
        {
          modifiedCount: result.modifiedCount,
          notifications: result.notifications,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to mark notifications as read for user ${req.user.userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  @Post('mark-all-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Mark all user notifications as read',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'All notifications marked as read successfully',
    type: ApiResponse,
  })
  async markAllNotificationsAsRead(
    @Request() req: any,
  ): Promise<ApiResponse<{ modifiedCount: number }>> {
    try {
      const userId = new Types.ObjectId(req.user.userId);
      const markAllDto: MarkNotificationsReadDto = { markAll: true };

      const result = await this.notificationService.markAsRead(
        userId,
        markAllDto,
      );

      this.logger.log(
        `Marked all ${result.modifiedCount} notifications as read for user ${userId}`,
      );

      return new ApiResponse(
        HttpStatus.OK,
        `Marked all ${result.modifiedCount} notifications as read`,
        { modifiedCount: result.modifiedCount },
      );
    } catch (error) {
      this.logger.error(
        `Failed to mark all notifications as read for user ${req.user.userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete notification
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete notification',
    description: 'Delete a specific notification',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    example: '507f1f77bcf86cd799439011',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Notification not found',
    type: ApiResponse,
  })
  async deleteNotification(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<ApiResponse<null>> {
    try {
      const userId = new Types.ObjectId(req.user.userId);
      const notificationId = new Types.ObjectId(id);

      await this.notificationService.delete(notificationId, userId);

      this.logger.log(`Deleted notification ${id} for user ${userId}`);
      return new ApiResponse(
        HttpStatus.OK,
        'Notification deleted successfully',
        null,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete notification ${id} for user ${req.user.userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  @Get('unread/count')
  @ApiOperation({
    summary: 'Get unread notification count',
    description: 'Get the count of unread notifications with optional grouping',
  })
  @ApiQuery({
    name: 'groupByType',
    required: false,
    type: Boolean,
    example: false,
  })
  @ApiQuery({
    name: 'groupByPriority',
    required: false,
    type: Boolean,
    example: false,
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
    type: ApiResponse,
  })
  async getUnreadCount(
    @Request() req: any,
    @Query() countDto: UnreadCountDto,
  ): Promise<ApiResponse<any>> {
    try {
      const userId = new Types.ObjectId(req.user.userId);
      const result = await this.notificationService.getUnreadCount(
        userId,
        countDto,
      );

      this.logger.debug(
        `Retrieved unread count for user ${userId}: ${result.total}`,
      );

      return new ApiResponse(
        HttpStatus.OK,
        'Unread count retrieved successfully',
        result,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get unread count for user ${req.user.userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get notification history
   */
  @Get('history')
  @ApiOperation({
    summary: 'Get notification history',
    description: 'Get user notification history with advanced filtering',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
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
  @ApiQuery({
    name: 'includeRead',
    required: false,
    type: Boolean,
    example: true,
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Notification history retrieved successfully',
    type: PaginatedResponse.withType(Notification),
  })
  async getNotificationHistory(
    @Request() req: any,
    @Query() filterDto: NotificationFilterDto,
  ): Promise<PaginatedResponse<Notification>> {
    try {
      const userId = new Types.ObjectId(req.user.userId);

      // Override to include read notifications for history
      const historyFilter = {
        ...filterDto,
        includeRead: true,
        limit: filterDto.limit || 50,
      };

      const result = await this.notificationService.findAll(
        userId,
        historyFilter,
      );

      this.logger.log(
        `Retrieved notification history for user ${userId}: ${result.notifications.length} items`,
      );

      return new PaginatedResponse(
        HttpStatus.OK,
        'Notification history retrieved successfully',
        {
          items: result.notifications,
          page: result.page,
          limit: filterDto.limit || 50,
          total: result.total,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to get notification history for user ${req.user.userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Track notification click
   */
  @Post(':id/click')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Track notification click',
    description: 'Track when a user clicks on a notification action',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    example: '507f1f77bcf86cd799439011',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Click tracked successfully',
    type: ApiResponse,
  })
  async trackNotificationClick(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<ApiResponse<null>> {
    try {
      const userId = new Types.ObjectId(req.user.userId);
      const notificationId = new Types.ObjectId(id);

      await this.analyticsService.trackClick(notificationId, userId);

      this.logger.debug(
        `Tracked click for notification ${id} by user ${userId}`,
      );

      return new ApiResponse(HttpStatus.OK, 'Click tracked successfully', null);
    } catch (error) {
      this.logger.error(
        `Failed to track click for notification ${id} by user ${req.user.userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Track notification conversion
   */
  @Post(':id/conversion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Track notification conversion',
    description: 'Track when a user completes an action from a notification',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    example: '507f1f77bcf86cd799439011',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Conversion tracked successfully',
    type: ApiResponse,
  })
  async trackNotificationConversion(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<ApiResponse<null>> {
    try {
      const userId = new Types.ObjectId(req.user.userId);
      const notificationId = new Types.ObjectId(id);

      await this.analyticsService.trackConversion(notificationId, userId);

      this.logger.debug(
        `Tracked conversion for notification ${id} by user ${userId}`,
      );

      return new ApiResponse(
        HttpStatus.OK,
        'Conversion tracked successfully',
        null,
      );
    } catch (error) {
      this.logger.error(
        `Failed to track conversion for notification ${id} by user ${req.user.userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Send test notification (for development)
   */
  @Post('test')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send test notification',
    description: 'Send a test notification to the current user',
  })
  @ApiBody({ type: CreateNotificationDto })
  @SwaggerApiResponse({
    status: 201,
    description: 'Test notification sent successfully',
    type: ApiResponse,
  })
  async sendTestNotification(
    @Request() req: any,
    @Body() createDto: CreateNotificationDto,
  ): Promise<ApiResponse<{ jobId: string; recipientId: string }>> {
    try {
      const userId = new Types.ObjectId(req.user.userId);

      // Override recipient to current user
      const testNotification = {
        ...createDto,
        recipientId: userId,
      };

      const jobId =
        await this.dispatcherService.sendNotification(testNotification);

      this.logger.log(
        `Sent test notification to user ${userId}, job ID: ${jobId}`,
      );

      return new ApiResponse(
        HttpStatus.CREATED,
        'Test notification sent successfully',
        {
          jobId,
          recipientId: userId.toString(),
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to send test notification to user ${req.user.userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
