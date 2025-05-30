import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { NFTService } from './nft.service';
import { NFT, NFTStatus } from './schemas/nft.schema';

/**
 * Controller for NFT management in the auction system
 */
@ApiTags('NFTs')
@Controller('nfts')
export class NFTController {
  constructor(private readonly nftService: NFTService) {}

  /**
   * Create a new NFT
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new NFT' })
  @ApiResponse({
    status: 201,
    description: 'NFT created successfully',
    type: NFT,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createNFT(
    @Body()
    createNFTDto: {
      title: string;
      description: string;
      imageUrl: string;
      metadata: {
        attributes: Array<{ trait_type: string; value: string | number }>;
        rarity: string;
        collection?: string;
      };
    },
  ): Promise<NFT> {
    return this.nftService.createNFT(createNFTDto);
  }

  /**
   * Get all NFTs with pagination and filtering
   */
  @Get()
  @ApiOperation({ summary: 'Get all NFTs with pagination and filtering' })
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
    enum: NFTStatus,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'rarity',
    required: false,
    type: String,
    description: 'Filter by rarity',
  })
  @ApiQuery({
    name: 'collection',
    required: false,
    type: String,
    description: 'Filter by collection',
  })
  @ApiResponse({ status: 200, description: 'NFTs retrieved successfully' })
  async getNFTs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: NFTStatus,
    @Query('rarity') rarity?: string,
    @Query('collection') collection?: string,
  ): Promise<{
    nfts: NFT[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.nftService.getNFTs(page, limit, status, rarity, collection);
  }

  /**
   * Get NFT by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get NFT by ID' })
  @ApiParam({ name: 'id', description: 'NFT ID' })
  @ApiResponse({
    status: 200,
    description: 'NFT retrieved successfully',
    type: NFT,
  })
  @ApiResponse({ status: 404, description: 'NFT not found' })
  async getNFTById(@Param('id') id: string): Promise<NFT> {
    return this.nftService.getNFTById(new Types.ObjectId(id));
  }

  /**
   * Update NFT
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update NFT' })
  @ApiParam({ name: 'id', description: 'NFT ID' })
  @ApiResponse({
    status: 200,
    description: 'NFT updated successfully',
    type: NFT,
  })
  @ApiResponse({ status: 404, description: 'NFT not found' })
  async updateNFT(
    @Param('id') id: string,
    @Body()
    updateNFTDto: Partial<{
      title: string;
      description: string;
      imageUrl: string;
      metadata: {
        attributes: Array<{ trait_type: string; value: string | number }>;
        rarity: string;
        collection?: string;
      };
      status: NFTStatus;
    }>,
  ): Promise<NFT> {
    return this.nftService.updateNFT(new Types.ObjectId(id), updateNFTDto);
  }

  /**
   * Delete NFT
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete NFT' })
  @ApiParam({ name: 'id', description: 'NFT ID' })
  @ApiResponse({ status: 204, description: 'NFT deleted successfully' })
  @ApiResponse({ status: 404, description: 'NFT not found' })
  async deleteNFT(@Param('id') id: string): Promise<void> {
    return this.nftService.deleteNFT(new Types.ObjectId(id));
  }

  /**
   * Update NFT status
   */
  @Put(':id/status')
  @ApiOperation({ summary: 'Update NFT status' })
  @ApiParam({ name: 'id', description: 'NFT ID' })
  @ApiResponse({
    status: 200,
    description: 'NFT status updated successfully',
    type: NFT,
  })
  @ApiResponse({ status: 404, description: 'NFT not found' })
  async updateNFTStatus(
    @Param('id') id: string,
    @Body() statusDto: { status: NFTStatus },
  ): Promise<NFT> {
    return this.nftService.updateNFTStatus(
      new Types.ObjectId(id),
      statusDto.status,
    );
  }
}
