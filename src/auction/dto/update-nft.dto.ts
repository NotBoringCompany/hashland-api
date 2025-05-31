import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateNFTDto } from './create-nft.dto';
import { NFTStatus } from '../schemas/nft.schema';

/**
 * DTO for updating an NFT
 */
export class UpdateNFTDto extends PartialType(CreateNFTDto) {
  @ApiProperty({
    description: 'The status of the NFT',
    enum: NFTStatus,
    example: NFTStatus.ACTIVE,
    required: false,
  })
  @IsOptional()
  @IsEnum(NFTStatus)
  status?: NFTStatus;
}

/**
 * DTO for updating NFT status only
 */
export class UpdateNFTStatusDto {
  @ApiProperty({
    description: 'The new status of the NFT',
    enum: NFTStatus,
    example: NFTStatus.ACTIVE,
  })
  @IsEnum(NFTStatus)
  status: NFTStatus;
}
