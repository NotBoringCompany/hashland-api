import { IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for joining auction whitelist
 */
export class JoinWhitelistDto {
  @ApiProperty({
    description: 'The ID of the operator joining the whitelist',
    example: '507f1f77bcf86cd799439013',
  })
  @IsMongoId()
  operatorId: string;
}
