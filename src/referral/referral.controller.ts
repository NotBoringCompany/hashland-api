import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt/jwt-auth.guard';
import { ReferralService } from './referral.service';
import { Types } from 'mongoose';
import { ApiResponse } from 'src/common/dto/response.dto';
import { ReferralStatsResponseDto } from './dto/referral.dto';
import { ReferredUsersResponseDto } from './dto/referred-users.dto';
import { PaginationQueryDto } from './dto/pagination.dto';

/**
 * Controller for handling referral-related HTTP requests
 */
@ApiTags('Referrals')
@Controller('referrals')
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  /**
   * Get the current user's referral data
   */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({
    summary: 'Get current user referral data',
    description: 'Retrieves referral statistics for the authenticated user',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Successfully retrieved referral stats',
    type: ReferralStatsResponseDto,
  })
  @SwaggerResponse({
    status: 404,
    description: 'User not found',
  })
  async getUserReferralData(
    @Request() req,
  ): Promise<ApiResponse<ReferralStatsResponseDto>> {
    const operatorId = new Types.ObjectId(req.user.userId);
    return this.referralService.getReferralStats(operatorId);
  }

  /**
   * Get list of users referred by the current user
   */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('referred-users/me')
  @ApiOperation({
    summary: 'Get users referred by the current user',
    description: 'Retrieves a list of users referred by the authenticated user',
  })
  @ApiQuery({
    type: PaginationQueryDto,
  })
  @SwaggerResponse({
    status: 200,
    description: 'Successfully retrieved referred users',
    type: ReferredUsersResponseDto,
  })
  @SwaggerResponse({
    status: 400,
    description: 'Invalid pagination parameters',
  })
  async getCurrentUserReferredList(
    @Request() req,
    @Query() query: PaginationQueryDto,
  ): Promise<ApiResponse<ReferredUsersResponseDto>> {
    const operatorId = new Types.ObjectId(req.user.userId);
    return this.referralService.getReferredUsers(
      operatorId,
      query.page,
      query.limit,
      query.projection,
    );
  }

  /**
   * Get referral data for a specific user
   */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiOperation({
    summary: 'Get referral data for a specific user',
    description: 'Retrieves referral statistics for a specified operator ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Operator ID',
    example: '507f1f77bcf86cd799439011',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Successfully retrieved referral stats',
    type: ReferralStatsResponseDto,
  })
  @SwaggerResponse({
    status: 404,
    description: 'User not found',
  })
  async getOperatorReferralData(
    @Param('id') id: string,
  ): Promise<ApiResponse<ReferralStatsResponseDto>> {
    const operatorId = new Types.ObjectId(id);
    return this.referralService.getReferralStats(operatorId);
  }

  /**
   * Get list of users referred by a specific user
   */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id/referred-users')
  @ApiOperation({
    summary: 'Get users referred by a specific user',
    description: 'Retrieves a list of users referred by the specified user ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Operator ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiQuery({
    type: PaginationQueryDto,
  })
  @SwaggerResponse({
    status: 200,
    description: 'Successfully retrieved referred users',
    type: ReferredUsersResponseDto,
  })
  @SwaggerResponse({
    status: 404,
    description: 'User not found',
  })
  @SwaggerResponse({
    status: 400,
    description: 'Invalid pagination parameters',
  })
  async getOperatorReferredList(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ): Promise<ApiResponse<ReferredUsersResponseDto>> {
    const operatorId = new Types.ObjectId(id);
    return this.referralService.getReferredUsers(
      operatorId,
      query.page,
      query.limit,
      query.projection,
    );
  }
}
