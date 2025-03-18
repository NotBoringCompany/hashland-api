import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreatePoolOperatorDto {
  @ApiProperty({
    description: 'The database ID of the operator who wants to join the pool',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsNotEmpty()
  operatorId: string;

  @ApiProperty({
    description: 'The database ID of the pool to join',
    example: '507f1f77bcf86cd799439012',
  })
  @IsString()
  @IsNotEmpty()
  poolId: string;
}

export class DeletePoolOperatorDto {
  @ApiProperty({
    description: 'The database ID of the operator to remove from their pool',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsNotEmpty()
  operatorId: string;
}
