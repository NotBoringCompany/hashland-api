import { Prop } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

/**
 * `PoolPrerequisites` defines the prerequisites for an operator to join the pool.
 */
export class PoolPrerequisites {
  /**
   * If `tgChannelId` is specified, the operator must be a member of the specified Telegram channel
   * to join the pool.
   */
  @ApiProperty({
    description:
      'The Telegram channel ID that operators must be a member of to join the pool',
    example: '-1001234567890',
    required: false,
  })
  @Prop({ required: false, default: null })
  tgChannelId?: string | null;
}
