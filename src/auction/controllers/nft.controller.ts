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
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { Types } from 'mongoose';
import { NFTService } from '../services/nft.service';
import { NFT, NFTStatus } from '../schemas/nft.schema';
import { CreateNFTDto, UpdateNFTDto, UpdateNFTStatusDto } from '../dto';
import { ApiResponse } from '../../common/dto/response.dto';
import { PaginatedResponse } from '../../common/dto/paginated-response.dto';

/**
 * Controller for NFT management in the auction system
 */
@ApiTags('NFTs')
@Controller('nfts')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class NFTController {
  constructor(private readonly nftService: NFTService) {}

  /**
   * Create a new NFT
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new NFT' })
  @ApiBody({ type: CreateNFTDto })
  @SwaggerApiResponse({
    status: 201,
    description: 'NFT created successfully',
    type: ApiResponse.withType(NFT),
  })
  @SwaggerApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
    type: ApiResponse,
  })
  async createNFT(
    @Body() createNFTDto: CreateNFTDto,
  ): Promise<ApiResponse<NFT>> {
    const nft = await this.nftService.createNFT(createNFTDto);
    return new ApiResponse(HttpStatus.CREATED, 'NFT created successfully', nft);
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
  @SwaggerApiResponse({
    status: 200,
    description: 'NFTs retrieved successfully',
    type: PaginatedResponse.withType(NFT),
  })
  async getNFTs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: NFTStatus,
    @Query('rarity') rarity?: string,
    @Query('collection') collection?: string,
  ): Promise<PaginatedResponse<NFT>> {
    const result = await this.nftService.getNFTs(
      page,
      limit,
      status,
      rarity,
      collection,
    );

    return new PaginatedResponse(HttpStatus.OK, 'NFTs retrieved successfully', {
      items: result.nfts,
      page: result.page,
      limit,
      total: result.total,
    });
  }

  /**
   * Get NFT by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get NFT by ID' })
  @ApiParam({ name: 'id', description: 'NFT ID' })
  @SwaggerApiResponse({
    status: 200,
    description: 'NFT retrieved successfully',
    type: ApiResponse.withType(NFT),
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'NFT not found',
    type: ApiResponse,
  })
  async getNFTById(@Param('id') id: string): Promise<ApiResponse<NFT>> {
    const nft = await this.nftService.getNFTById(new Types.ObjectId(id));
    return new ApiResponse(HttpStatus.OK, 'NFT retrieved successfully', nft);
  }

  /**
   * Update NFT
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update NFT' })
  @ApiParam({ name: 'id', description: 'NFT ID' })
  @ApiBody({ type: UpdateNFTDto })
  @SwaggerApiResponse({
    status: 200,
    description: 'NFT updated successfully',
    type: ApiResponse.withType(NFT),
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'NFT not found',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
    type: ApiResponse,
  })
  async updateNFT(
    @Param('id') id: string,
    @Body() updateNFTDto: UpdateNFTDto,
  ): Promise<ApiResponse<NFT>> {
    const nft = await this.nftService.updateNFT(
      new Types.ObjectId(id),
      updateNFTDto,
    );
    return new ApiResponse(HttpStatus.OK, 'NFT updated successfully', nft);
  }

  /**
   * Delete NFT
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete NFT' })
  @ApiParam({ name: 'id', description: 'NFT ID' })
  @SwaggerApiResponse({
    status: 204,
    description: 'NFT deleted successfully',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'NFT not found',
    type: ApiResponse,
  })
  async deleteNFT(@Param('id') id: string): Promise<ApiResponse<null>> {
    await this.nftService.deleteNFT(new Types.ObjectId(id));
    return new ApiResponse(
      HttpStatus.NO_CONTENT,
      'NFT deleted successfully',
      null,
    );
  }

  /**
   * Update NFT status
   */
  @Put(':id/status')
  @ApiOperation({ summary: 'Update NFT status' })
  @ApiParam({ name: 'id', description: 'NFT ID' })
  @ApiBody({ type: UpdateNFTStatusDto })
  @SwaggerApiResponse({
    status: 200,
    description: 'NFT status updated successfully',
    type: ApiResponse.withType(NFT),
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'NFT not found',
    type: ApiResponse,
  })
  @SwaggerApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
    type: ApiResponse,
  })
  async updateNFTStatus(
    @Param('id') id: string,
    @Body() statusDto: UpdateNFTStatusDto,
  ): Promise<ApiResponse<NFT>> {
    const nft = await this.nftService.updateNFTStatus(
      new Types.ObjectId(id),
      statusDto.status,
    );
    return new ApiResponse(
      HttpStatus.OK,
      'NFT status updated successfully',
      nft,
    );
  }
}
