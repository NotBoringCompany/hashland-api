import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

/**
 * DTO for creating a Telegram channel join task
 */
export class CreateTelegramChannelJoinTaskDto {
  @ApiProperty({
    description: 'The name of the task',
    example: 'Join our official Telegram channel',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'The description of the task',
    example: 'Join our official Telegram channel to receive news and updates.',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'The maximum number of times this task can be completed',
    example: 1,
    required: true,
  })
  @IsInt()
  @IsPositive()
  maxCompletions: number;

  @ApiProperty({
    description: 'The amount of fuel to reward for completing the task',
    example: 100,
    required: true,
  })
  @IsNumber()
  @Min(0)
  fuelReward: number;

  @ApiProperty({
    description: 'The Telegram channel ID',
    example: '-1001234567890',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @ApiProperty({
    description: 'The name/title of the Telegram channel',
    example: 'HashLand Official',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  channelName: string;
}
