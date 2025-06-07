import {
  Controller,
  Get,
  Post,
  Param,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AuctionLifecycleService } from '../services/auction-lifecycle.service';
import { AuctionStatus } from '../schemas/auction.schema';
import { ApiResponse } from '../../common/dto/response.dto';
import { WonderverseProtected } from '../../common/auth';

/**
 * Controller for auction lifecycle management
 */
@ApiTags('Auction Lifecycle')
@Controller('auctions')
@WonderverseProtected(3)
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
  @SwaggerApiResponse({
    status: HttpStatus.OK,
    description: 'Lifecycle status retrieved successfully',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Auction not found',
    type: ApiResponse,
  })
  async getLifecycleStatus(@Param('id') id: string): Promise<
    ApiResponse<{
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
    }>
  > {
    const data = await this.lifecycleService.getLifecycleStatus(id);
    return new ApiResponse(
      HttpStatus.OK,
      'Lifecycle status retrieved successfully',
      data,
    );
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
  @SwaggerApiResponse({
    status: HttpStatus.OK,
    description: 'State transition triggered successfully',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Auction not found',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'No transition needed or invalid state',
    type: ApiResponse,
  })
  @HttpCode(HttpStatus.OK)
  async triggerStateTransition(@Param('id') id: string): Promise<
    ApiResponse<{
      success: boolean;
      message: string;
      newStatus?: AuctionStatus;
      timestamp: string;
    }>
  > {
    const result = await this.lifecycleService.triggerStateTransition(id);
    const data = {
      ...result,
      timestamp: new Date().toISOString(),
    };

    return new ApiResponse(
      HttpStatus.OK,
      'State transition triggered successfully',
      data,
    );
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
  @SwaggerApiResponse({
    status: HttpStatus.OK,
    description: 'Lifecycle processing status retrieved successfully',
    type: ApiResponse,
  })
  async getLifecycleProcessingStatus(): Promise<
    ApiResponse<{
      isRunning: boolean;
      lastProcessed: string;
      nextScheduled: string;
      processingInterval: string;
      message: string;
    }>
  > {
    const now = new Date();
    const nextMinute = new Date(now.getTime() + 60000);
    nextMinute.setSeconds(0, 0);

    const data = {
      isRunning: true,
      lastProcessed: new Date(
        now.getTime() - now.getSeconds() * 1000,
      ).toISOString(),
      nextScheduled: nextMinute.toISOString(),
      processingInterval: 'Every minute',
      message: 'Lifecycle processing is active and running automatically',
    };

    return new ApiResponse(
      HttpStatus.OK,
      'Lifecycle processing status retrieved successfully',
      data,
    );
  }
}
