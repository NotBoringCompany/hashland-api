import { Prop } from '@nestjs/mongoose';

/**
 * `PoolPrerequisites` defines the prerequisites for an operator to join the pool.
 */
export class PoolPrerequisites {
  /**
   * If `tgChannelId` is specified, the operator must be a member of the specified Telegram channel
   * to join the pool.
   */
  @Prop({ required: false, default: null })
  tgChannelId?: string | null;
}
