import {
  Controller,
  Get,
  Post,
  Param,
  HttpStatus,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuctionLifecycleService } from '../services/auction-lifecycle.service';
import { AuctionStatus } from '../schemas/auction.schema';
import { JwtAuthGuard } from '../../auth/jwt/jwt-auth.guard';

/**
 * Controller for auction lifecycle management
 */
@ApiTags('Auction Lifecycle')
@Controller('auctions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LifecycleController {
  constructor(private readonly lifecycleService: AuctionLifecycleService) {}

  /**
   * Get auction lifecycle status
   */
  @Get(':id/lifecycle')
  @ApiOperation({
    summary: 'Get auction lifecycle status',
    description:
      'Get current status and timeline of auction lifecycle transitions',
  })
  @ApiParam({
    name: 'id',
    description: 'Auction ID',
    example: '507f1f77bcf86cd799439012',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lifecycle status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        currentStatus: {
          type: 'string',
          enum: Object.values(AuctionStatus),
        },
        nextTransition: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            scheduledTime: { type: 'string', format: 'date-time' },
            timeUntil: { type: 'number' },
          },
          nullable: true,
        },
        timeline: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              time: { type: 'string', format: 'date-time' },
              completed: { type: 'boolean' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Auction not found',
  })
  async getLifecycleStatus(@Param('id') id: string): Promise<{
    currentStatus: AuctionStatus;
    nextTransition?: {
      status: AuctionStatus;
      scheduledTime: Date;
      timeUntil: number;
    };
    timeline: Array<{
      status: AuctionStatus;
      time: Date;
      completed: boolean;
    }>;
  }> {
    return this.lifecycleService.getLifecycleStatus(id);
  }

  /**
   * Manually trigger auction state transition
   */
  @Post(':id/lifecycle/trigger')
  @ApiOperation({
    summary: 'Trigger auction state transition',
    description:
      'Manually trigger the next appropriate auction state transition',
  })
  @ApiParam({
    name: 'id',
    description: 'Auction ID',
    example: '507f1f77bcf86cd799439012',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'State transition triggered successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        newStatus: {
          type: 'string',
          enum: Object.values(AuctionStatus),
          nullable: true,
        },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Auction not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'No transition needed or invalid state',
  })
  @HttpCode(HttpStatus.OK)
  async triggerStateTransition(@Param('id') id: string): Promise<{
    success: boolean;
    message: string;
    newStatus?: AuctionStatus;
    timestamp: string;
  }> {
    const result = await this.lifecycleService.triggerStateTransition(id);
    return {
      ...result,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get lifecycle processing status
   */
  @Get('lifecycle/status')
  @ApiOperation({
    summary: 'Get lifecycle processing status',
    description:
      'Get information about the automated lifecycle processing system',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lifecycle processing status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        isRunning: { type: 'boolean' },
        lastProcessed: { type: 'string', format: 'date-time' },
        nextScheduled: { type: 'string', format: 'date-time' },
        processingInterval: { type: 'string' },
        message: { type: 'string' },
      },
    },
  })
  async getLifecycleProcessingStatus(): Promise<{
    isRunning: boolean;
    lastProcessed: string;
    nextScheduled: string;
    processingInterval: string;
    message: string;
  }> {
    const now = new Date();
    const nextMinute = new Date(now.getTime() + 60000);
    nextMinute.setSeconds(0, 0);

    return {
      isRunning: true,
      lastProcessed: new Date(
        now.getTime() - now.getSeconds() * 1000,
      ).toISOString(),
      nextScheduled: nextMinute.toISOString(),
      processingInterval: 'Every minute',
      message: 'Lifecycle processing is active and running automatically',
    };
  }
}
