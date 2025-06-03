import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Types } from 'mongoose';
import { AuctionService } from '../services/auction.service';
import { Auction } from '../schemas/auction.schema';
import { AuctionWhitelist } from '../schemas/auction-whitelist.schema';
import { Bid } from '../schemas/bid.schema';
import { AuctionHistory } from '../schemas/auction-history.schema';
import {
  CreateAuctionDto,
  PlaceBidDto,
  JoinWhitelistDto,
  GetAuctionsQueryDto,
  GetAuctionHistoryQueryDto,
} from '../dto';
import { ApiResponse } from '../../common/dto/response.dto';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';
import { AdminProtected } from '../../auth/admin';
import { JwtAuthGuard } from '../../auth/jwt/jwt-auth.guard';

/**
 * Controller for auction management in the auction system
 */
@ApiTags('Auctions')
@Controller('auctions')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AuctionController {
  constructor(private readonly auctionService: AuctionService) {}

  /**
   * Create a new auction
   */
  @Post()
  @AdminProtected()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new auction' })
  @ApiBody({ type: CreateAuctionDto })
  @SwaggerApiResponse({
    status: 201,
    description: 'Auction created successfully',
    type: ApiResponse.withType(Auction),
  })
  @SwaggerApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'NFT not found',
    type: ApiResponse,
  })
  async createAuction(
    @Body() createAuctionDto: CreateAuctionDto,
  ): Promise<ApiResponse<Auction>> {
    const auction = await this.auctionService.createAuction({
      nftId: new Types.ObjectId(createAuctionDto.nftId),
      title: createAuctionDto.title,
      description: createAuctionDto.description,
      startingPrice: createAuctionDto.startingPrice,
      whitelistConfig: {
        maxParticipants: createAuctionDto.whitelistConfig.maxParticipants,
        entryFee: createAuctionDto.whitelistConfig.entryFee,
        startTime: new Date(createAuctionDto.whitelistConfig.startTime),
        endTime: new Date(createAuctionDto.whitelistConfig.endTime),
      },
      auctionConfig: {
        startTime: new Date(createAuctionDto.auctionConfig.startTime),
        endTime: new Date(createAuctionDto.auctionConfig.endTime),
        minBidIncrement: createAuctionDto.auctionConfig.minBidIncrement,
        reservePrice: createAuctionDto.auctionConfig.reservePrice,
        buyNowPrice: createAuctionDto.auctionConfig.buyNowPrice,
      },
    });

    return new ApiResponse(
      HttpStatus.CREATED,
      'Auction created successfully',
      auction,
    );
  }

  /**
   * Get all auctions with pagination and filtering
   */
  @Get()
  @ApiOperation({ summary: 'Get all auctionss with pagination and filtering' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Auctions retrieved successfully',
    type: PaginatedResponse.withType(Auction),
  })
  async getAuctions(
    @Query() query: GetAuctionsQueryDto,
  ): Promise<PaginatedResponse<Auction>> {
    const result = await this.auctionService.getAuctions(
      query.page || 1,
      query.limit || 20,
      query.status,
      {
        nftId: query.nftId,
        currentWinner: query.currentWinner,
        titleSearch: query.titleSearch,
        descriptionSearch: query.descriptionSearch,
        minStartingPrice: query.minStartingPrice,
        maxStartingPrice: query.maxStartingPrice,
        minCurrentBid: query.minCurrentBid,
        maxCurrentBid: query.maxCurrentBid,
        auctionStartAfter: query.auctionStartAfter,
        auctionStartBefore: query.auctionStartBefore,
        auctionEndAfter: query.auctionEndAfter,
        auctionEndBefore: query.auctionEndBefore,
        createdAfter: query.createdAfter,
        createdBefore: query.createdBefore,
        minTotalBids: query.minTotalBids,
        maxTotalBids: query.maxTotalBids,
        minTotalParticipants: query.minTotalParticipants,
        maxTotalParticipants: query.maxTotalParticipants,
        populateNFT: query.populateNFT,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
    );

    return new PaginatedResponse(
      HttpStatus.OK,
      'Auctions retrieved successfully',
      {
        items: result.auctions,
        page: result.page,
        limit: query.limit || 20,
        total: result.total,
      },
    );
  }

  /**
   * Get auction by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get auction by ID' })
  @ApiParam({ name: 'id', description: 'Auction ID' })
  @ApiQuery({
    name: 'populateNFT',
    required: false,
    type: Boolean,
    description: 'Populate NFT data',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Auction retrieved successfully',
    type: ApiResponse.withType(Auction),
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Auction not found',
    type: ApiResponse,
  })
  async getAuctionById(@Param('id') id: string): Promise<ApiResponse<Auction>> {
    const auction = await this.auctionService.getAuctionById(
      new Types.ObjectId(id),
    );

    return new ApiResponse(
      HttpStatus.OK,
      'Auction retrieved successfully',
      auction,
    );
  }

  /**
   * Join auction whitelist
   */
  @Post(':id/whitelist')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Join auction whitelist' })
  @ApiParam({ name: 'id', description: 'Auction ID' })
  @ApiBody({ type: JoinWhitelistDto })
  @SwaggerApiResponse({
    status: 201,
    description: 'Successfully joined whitelist',
    type: ApiResponse.withType(AuctionWhitelist),
  })
  @SwaggerApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Auction not found',
    type: ApiResponse,
  })
  async joinWhitelist(
    @Param('id') id: string,
    @Body() joinWhitelistDto: JoinWhitelistDto,
  ): Promise<ApiResponse<AuctionWhitelist>> {
    const whitelist = await this.auctionService.joinWhitelist(
      new Types.ObjectId(id),
      new Types.ObjectId(joinWhitelistDto.operatorId),
    );

    return new ApiResponse(
      HttpStatus.CREATED,
      'Successfully joined whitelist',
      whitelist,
    );
  }

  /**
   * Place a bid on an auction
   */
  @Post(':id/bids')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Place a bid on an auction' })
  @ApiParam({ name: 'id', description: 'Auction ID' })
  @ApiBody({ type: PlaceBidDto })
  @SwaggerApiResponse({
    status: 201,
    description: 'Bid placed successfully',
    type: ApiResponse.withType(Bid),
  })
  @SwaggerApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Auction not found',
    type: ApiResponse,
  })
  async placeBid(
    @Param('id') id: string,
    @Body() placeBidDto: PlaceBidDto,
  ): Promise<ApiResponse<Bid>> {
    const bid = await this.auctionService.placeBid(
      new Types.ObjectId(id),
      new Types.ObjectId(placeBidDto.bidderId),
      placeBidDto.amount,
      placeBidDto.bidType,
      placeBidDto.metadata,
    );

    return new ApiResponse(HttpStatus.CREATED, 'Bid placed successfully', bid);
  }

  /**
   * End an auction
   */
  @Post(':id/end')
  @AdminProtected()
  @ApiOperation({ summary: 'End an auction' })
  @ApiParam({ name: 'id', description: 'Auction ID' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Auction ended successfully',
    type: ApiResponse.withType(Auction),
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Auction not found',
    type: ApiResponse,
  })
  async endAuction(@Param('id') id: string): Promise<ApiResponse<Auction>> {
    const auction = await this.auctionService.endAuction(
      new Types.ObjectId(id),
    );
    return new ApiResponse(
      HttpStatus.OK,
      'Auction ended successfully',
      auction,
    );
  }

  /**
   * Get auction history for authenticated operator
   */
  @Get('histories')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get auction history for authenticated operator' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Auction history retrieved successfully',
    type: PaginatedResponse.withType(AuctionHistory),
  })
  async getAuctionHistory(
    @Query() query: GetAuctionHistoryQueryDto,
    @Request() req,
  ): Promise<PaginatedResponse<AuctionHistory>> {
    // Ensure operatorId is always set from authenticated user
    const filters = {
      ...query,
      operatorId: req.user.operatorId,
    };

    const result = await this.auctionService.getAuctionHistories(filters);

    return new PaginatedResponse(
      HttpStatus.OK,
      'Auction history retrieved successfully',
      {
        items: result.history,
        page: result.page,
        limit: query.limit || 50,
        total: result.total,
      },
    );
  }

  /**
   * Place a bid via queue (for high-frequency scenarios)
   */
  @Post(':id/bid/queue')
  @ApiOperation({
    summary: 'Place a bid via queue',
    description:
      'Place a bid using the queue system for high-frequency scenarios',
  })
  @ApiParam({ name: 'id', description: 'Auction ID' })
  @ApiBody({ type: PlaceBidDto })
  @SwaggerApiResponse({
    status: 201,
    description: 'Bid queued successfully',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 400,
    description: 'Invalid bid data',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Auction not found',
    type: ApiResponse,
  })
  async placeBidQueued(
    @Param('id') id: string,
    @Body() placeBidDto: PlaceBidDto,
  ): Promise<
    ApiResponse<{
      jobId: string;
      message: string;
      queued: boolean;
      timestamp: string;
    }>
  > {
    const result = await this.auctionService.placeBidQueued(
      new Types.ObjectId(id),
      new Types.ObjectId(placeBidDto.bidderId),
      placeBidDto.amount,
      placeBidDto.bidType,
      {
        source: 'api',
        timestamp: new Date().toISOString(),
      },
    );

    const responseData = {
      ...result,
      queued: true,
      timestamp: new Date().toISOString(),
    };

    return new ApiResponse(
      HttpStatus.CREATED,
      'Bid queued successfully',
      responseData,
    );
  }

  /**
   * Check if auction should use queue
   */
  @Get(':id/queue-status')
  @ApiOperation({
    summary: 'Check if auction should use queue',
    description:
      'Check if auction is in high-frequency mode and should use queue processing',
  })
  @ApiParam({ name: 'id', description: 'Auction ID' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Queue status retrieved successfully',
    type: ApiResponse,
  })
  async getQueueStatus(@Param('id') id: string): Promise<
    ApiResponse<{
      shouldUseQueue: boolean;
      reason: string;
      timestamp: string;
    }>
  > {
    const shouldUseQueue = await this.auctionService.shouldUseQueue(
      new Types.ObjectId(id),
    );

    let reason = 'Low activity - direct processing';
    if (shouldUseQueue) {
      reason = 'High activity or ending soon - queue processing recommended';
    }

    const responseData = {
      shouldUseQueue,
      reason,
      timestamp: new Date().toISOString(),
    };

    return new ApiResponse(
      HttpStatus.OK,
      'Queue status retrieved successfully',
      responseData,
    );
  }
}
