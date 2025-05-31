import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Enum defining the status of NFTs
 */
export enum NFTStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  IN_AUCTION = 'in_auction',
  SOLD = 'sold',
  CANCELLED = 'cancelled',
}

/**
 * Schema for NFT metadata attributes
 */
export interface NFTAttribute {
  trait_type: string;
  value: string | number;
}

/**
 * Schema for NFT metadata
 */
export interface NFTMetadata {
  attributes: NFTAttribute[];
  rarity: string;
}

/**
 * Schema for NFTs in the auction system
 */
@Schema({
  timestamps: true,
  collection: 'NFTs',
  versionKey: false,
})
export class NFT extends Document {
  /**
   * The database ID of the NFT
   */
  @ApiProperty({
    description: 'The database ID of the NFT',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
    primaryKey: true,
  })
  _id: Types.ObjectId;

  /**
   * The title of the NFT
   */
  @ApiProperty({
    description: 'The title of the NFT',
    example: 'Rare Digital Artwork #001',
  })
  @Prop({ required: true })
  title: string;

  /**
   * The description of the NFT
   */
  @ApiProperty({
    description: 'The description of the NFT',
    example: 'A unique digital artwork featuring abstract patterns',
  })
  @Prop({ required: true })
  description: string;

  /**
   * The image URL of the NFT
   */
  @ApiProperty({
    description: 'The image URL of the NFT',
    example: 'https://example.com/nft/image.jpg',
  })
  @Prop({ required: true })
  imageUrl: string;

  /**
   * The metadata of the NFT including attributes and rarity
   */
  @ApiProperty({
    description: 'The metadata of the NFT including attributes and rarity',
    example: {
      attributes: [
        { trait_type: 'Color', value: 'Blue' },
        { trait_type: 'Rarity', value: 'Legendary' },
      ],
      rarity: 'Legendary',
    },
  })
  @Prop({
    type: {
      attributes: [
        {
          trait_type: { type: String, required: true },
          value: { type: MongooseSchema.Types.Mixed, required: true },
        },
      ],
      rarity: { type: String, required: true },
    },
    required: true,
  })
  metadata: NFTMetadata;

  /**
   * The status of the NFT
   */
  @ApiProperty({
    description: 'The status of the NFT',
    example: 'active',
    enum: NFTStatus,
  })
  @Prop({
    type: String,
    enum: NFTStatus,
    default: NFTStatus.DRAFT,
    required: true,
  })
  status: NFTStatus;

  /**
   * The timestamp when the NFT was created
   */
  @ApiProperty({
    description: 'The timestamp when the NFT was created',
    example: '2024-03-19T12:00:00.000Z',
  })
  createdAt: Date;

  /**
   * The timestamp when the NFT was last updated
   */
  @ApiProperty({
    description: 'The timestamp when the NFT was last updated',
    example: '2024-03-19T12:00:00.000Z',
  })
  updatedAt: Date;
}

/**
 * Generate the Mongoose schema for NFT
 */
export const NFTSchema = SchemaFactory.createForClass(NFT);

// Create indexes for better query performance
NFTSchema.index({ status: 1 });
NFTSchema.index({ 'metadata.rarity': 1 });
NFTSchema.index({ createdAt: -1 });
