import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
  Query,
  Post,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt/jwt-auth.guard';
import { ReferralService } from './referral.service';
import { Types } from 'mongoose';
import { ApiResponse } from 'src/common/dto/response.dto';
import { ReferralStatsResponseDto } from './dto/referral.dto';
import { ReferredUserDto } from './dto/referred-users.dto';
import { PaginationQueryDto } from './dto/pagination.dto';
import { PaginatedResponse } from 'src/common/dto/paginated-response.dto';
import {
  CreateStarterCodeDto,
  StarterCodeResponseDto,
  UseStarterCodeDto,
} from './dto/starter-code.dto';
import { StarterCode } from './schemas/starter-code.schema';

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
    type: () => PaginatedResponse.withType(ReferredUserDto),
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
  ): Promise<PaginatedResponse<ReferredUserDto>> {
    const operatorId = new Types.ObjectId(id);
    return this.referralService.getReferredUsers(
      operatorId,
      query.page,
      query.limit,
      query.projection,
    );
  }

  /**
   * Create a new starter code
   */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('starter-code')
  @ApiOperation({
    summary: 'Create a new starter code',
    description: 'Creates a new starter code that can be used for referrals',
  })
  @ApiBody({
    type: CreateStarterCodeDto,
  })
  @SwaggerResponse({
    status: 200,
    description: 'Successfully created starter code',
    type: StarterCodeResponseDto,
  })
  @SwaggerResponse({
    status: 400,
    description: 'Bad request',
  })
  async createStarterCode(
    @Body() createStarterCodeDto: CreateStarterCodeDto,
    @Request() req,
  ): Promise<ApiResponse<StarterCodeResponseDto>> {
    // If createdBy is not provided, use the authenticated user
    if (!createStarterCodeDto.createdBy) {
      createStarterCodeDto.createdBy = req.user.userId;
    }
    return this.referralService.createStarterCode(createStarterCodeDto);
  }

  /**
   * Validate a starter code without using it
   */
  @Get('starter-code/validate/:code')
  @ApiOperation({
    summary: 'Validate a starter code',
    description: 'Validates a starter code without using it',
  })
  @ApiParam({
    name: 'code',
    description: 'Starter code to validate',
    example: 'STARTABC123',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Validation result',
    type: StarterCodeResponseDto,
  })
  async validateStarterCode(
    @Param('code') code: string,
  ): Promise<ApiResponse<StarterCodeResponseDto>> {
    return this.referralService.validateStarterCode(code);
  }

  /**
   * Use a starter code
   */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('starter-code/use')
  @ApiOperation({
    summary: 'Use a starter code',
    description: 'Process the use of a starter code by an operator',
  })
  @ApiBody({
    type: UseStarterCodeDto,
  })
  @SwaggerResponse({
    status: 200,
    description: 'Successfully used starter code',
  })
  @SwaggerResponse({
    status: 400,
    description: 'Bad request',
  })
  @SwaggerResponse({
    status: 404,
    description: 'Starter code or operator not found',
  })
  async useStarterCode(
    @Body() useStarterCodeDto: UseStarterCodeDto,
    @Request() req,
  ): Promise<ApiResponse<{ success: boolean }>> {
    // If operatorId is not provided, use the authenticated user
    if (!useStarterCodeDto.operatorId) {
      useStarterCodeDto.operatorId = req.user.userId;
    }
    return this.referralService.useStarterCode(useStarterCodeDto);
  }

  /**
   * Get all starter codes with pagination
   */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('starter-codes')
  @ApiOperation({
    summary: 'Get all starter codes',
    description: 'Retrieves a paginated list of all starter codes',
  })
  @ApiQuery({
    type: PaginationQueryDto,
  })
  @SwaggerResponse({
    status: 200,
    description: 'Successfully retrieved starter codes',
    type: () => PaginatedResponse.withType(StarterCode),
  })
  async getAllStarterCodes(
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponse<StarterCode>> {
    return this.referralService.getStarterCodes(query.page, query.limit);
  }
}
