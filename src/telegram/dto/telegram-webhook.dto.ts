import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

/**
 * DTO for Telegram webhook update payload
 */
export class TelegramWebhookDto {
  @ApiProperty({
    description: 'The raw update from Telegram',
    example: { update_id: 123456789, message: { text: 'Hello' } },
  })
  @IsNotEmpty()
  @IsObject()
  update: Record<string, any>;
}

/**
 * DTO for checking channel membership
 */
export class CheckChannelMembershipDto {
  @ApiProperty({
    description: 'The Telegram User ID to check membership for',
    example: '123456789',
  })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'The channel ID to check membership for',
    example: '-1001234567890',
  })
  @IsNotEmpty()
  @IsString()
  channelId: string;
}

/**
 * DTO for configuring a Telegram webhook
 */
export class SetWebhookDto {
  @ApiProperty({
    description: 'The URL for the webhook',
    example: 'https://example.com/webhook',
  })
  @IsNotEmpty()
  @IsString()
  url: string;

  @ApiProperty({
    description: 'Optional secret token to verify webhook',
    example: 'secret_token_123',
    required: false,
  })
  @IsOptional()
  @IsString()
  secretToken?: string;
}

/**
 * Response DTO for channel membership check
 */
export class ChannelMembershipResponseDto {
  @ApiProperty({
    description: 'Whether the user is a member of the channel',
    example: true,
  })
  isMember: boolean;

  @ApiProperty({
    description: 'The last time membership was verified',
    example: '2023-01-01T00:00:00.000Z',
  })
  lastVerified: Date;

  @ApiProperty({
    description: 'The channel title/name',
    example: 'HashLand Official',
  })
  channelTitle: string;

  constructor(partial: Partial<ChannelMembershipResponseDto>) {
    Object.assign(this, partial);
  }
}
