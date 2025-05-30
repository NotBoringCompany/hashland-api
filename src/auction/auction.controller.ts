import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Types } from 'mongoose';
import { AuctionService } from './auction.service';
import { Auction, AuctionStatus } from './schemas/auction.schema';
import { AuctionWhitelist } from './schemas/auction-whitelist.schema';
import { Bid, BidType } from './schemas/bid.schema';
import { AuctionHistory } from './schemas/auction-history.schema';

/**
 * Controller for auction management in the auction system
 */
@ApiTags('Auctions')
@Controller('auctions')
export class AuctionController {
  constructor(private readonly auctionService: AuctionService) {}

  /**
   * Create a new auction
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new auction' })
  @ApiResponse({
    status: 201,
    description: 'Auction created successfully',
    type: Auction,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createAuction(
    @Body()
    createAuctionDto: {
      nftId: string;
      title: string;
      description: string;
      startingPrice: number;
      whitelistConfig: {
        maxParticipants: number;
        entryFee: number;
        startTime: string;
        endTime: string;
      };
      auctionConfig: {
        startTime: string;
        endTime: string;
        minBidIncrement: number;
        reservePrice?: number;
        buyNowPrice?: number;
      };
    },
  ): Promise<Auction> {
    return this.auctionService.createAuction({
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
  }

  /**
   * Get all auctions with pagination and filtering
   */
  @Get()
  @ApiOperation({ summary: 'Get all auctions with pagination and filtering' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: AuctionStatus,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'populateNFT',
    required: false,
    type: Boolean,
    description: 'Populate NFT data',
  })
  @ApiResponse({ status: 200, description: 'Auctions retrieved successfully' })
  async getAuctions(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: AuctionStatus,
    @Query('populateNFT', new DefaultValuePipe(true)) populateNFT?: boolean,
  ): Promise<{
    auctions: Auction[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.auctionService.getAuctions(page, limit, status, populateNFT);
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
  @ApiResponse({
    status: 200,
    description: 'Auction retrieved successfully',
    type: Auction,
  })
  @ApiResponse({ status: 404, description: 'Auction not found' })
  async getAuctionById(
    @Param('id') id: string,
    @Query('populateNFT', new DefaultValuePipe(true)) populateNFT?: boolean,
  ): Promise<Auction> {
    return this.auctionService.getAuctionById(
      new Types.ObjectId(id),
      populateNFT,
    );
  }

  /**
   * Join auction whitelist
   */
  @Post(':id/whitelist')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Join auction whitelist' })
  @ApiParam({ name: 'id', description: 'Auction ID' })
  @ApiResponse({
    status: 201,
    description: 'Successfully joined whitelist',
    type: AuctionWhitelist,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Auction not found' })
  async joinWhitelist(
    @Param('id') id: string,
    @Body() joinWhitelistDto: { operatorId: string },
  ): Promise<AuctionWhitelist> {
    return this.auctionService.joinWhitelist(
      new Types.ObjectId(id),
      new Types.ObjectId(joinWhitelistDto.operatorId),
    );
  }

  /**
   * Place a bid on an auction
   */
  @Post(':id/bids')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Place a bid on an auction' })
  @ApiParam({ name: 'id', description: 'Auction ID' })
  @ApiResponse({
    status: 201,
    description: 'Bid placed successfully',
    type: Bid,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Auction not found' })
  async placeBid(
    @Param('id') id: string,
    @Body()
    placeBidDto: {
      bidderId: string;
      amount: number;
      bidType?: BidType;
      metadata?: { userAgent?: string; ipAddress?: string };
    },
  ): Promise<Bid> {
    return this.auctionService.placeBid(
      new Types.ObjectId(id),
      new Types.ObjectId(placeBidDto.bidderId),
      placeBidDto.amount,
      placeBidDto.bidType || BidType.REGULAR,
      placeBidDto.metadata,
    );
  }

  /**
   * End an auction
   */
  @Post(':id/end')
  @ApiOperation({ summary: 'End an auction' })
  @ApiParam({ name: 'id', description: 'Auction ID' })
  @ApiResponse({
    status: 200,
    description: 'Auction ended successfully',
    type: Auction,
  })
  @ApiResponse({ status: 404, description: 'Auction not found' })
  async endAuction(@Param('id') id: string): Promise<Auction> {
    return this.auctionService.endAuction(new Types.ObjectId(id));
  }

  /**
   * Get auction history
   */
  @Get(':id/history')
  @ApiOperation({ summary: 'Get auction history' })
  @ApiParam({ name: 'id', description: 'Auction ID' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiResponse({
    status: 200,
    description: 'Auction history retrieved successfully',
  })
  async getAuctionHistory(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<{
    history: AuctionHistory[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.auctionService.getAuctionHistory(
      new Types.ObjectId(id),
      page,
      limit,
    );
  }
}
