import {
  IsString,
  IsNotEmpty,
  IsUrl,
  IsArray,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for NFT attribute
 */
export class NFTAttributeDto {
  @ApiProperty({
    description: 'The trait type of the attribute',
    example: 'Color',
  })
  @IsString()
  @IsNotEmpty()
  trait_type: string;

  @ApiProperty({
    description: 'The value of the attribute',
    example: 'Blue',
  })
  @IsNotEmpty()
  value: string | number;
}

/**
 * DTO for NFT metadata
 */
export class NFTMetadataDto {
  @ApiProperty({
    description: 'Array of NFT attributes',
    type: [NFTAttributeDto],
    example: [
      { trait_type: 'Color', value: 'Blue' },
      { trait_type: 'Rarity', value: 'Legendary' },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NFTAttributeDto)
  attributes: NFTAttributeDto[];

  @ApiProperty({
    description: 'The rarity of the NFT',
    example: 'Legendary',
  })
  @IsString()
  @IsNotEmpty()
  rarity: string;

  @ApiProperty({
    description: 'The collection the NFT belongs to',
    example: 'Digital Art Collection',
    required: false,
  })
  @IsOptional()
  @IsString()
  collection?: string;
}

/**
 * DTO for creating a new NFT
 */
export class CreateNFTDto {
  @ApiProperty({
    description: 'The title of the NFT',
    example: 'Rare Digital Artwork #001',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'The description of the NFT',
    example: 'A unique digital artwork featuring abstract patterns',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'The image URL of the NFT',
    example: 'https://example.com/nft/image.jpg',
  })
  @IsUrl()
  @IsNotEmpty()
  imageUrl: string;

  @ApiProperty({
    description: 'The metadata of the NFT',
    type: NFTMetadataDto,
  })
  @ValidateNested()
  @Type(() => NFTMetadataDto)
  metadata: NFTMetadataDto;
}
