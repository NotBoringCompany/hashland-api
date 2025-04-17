import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Schema for tracking operator membership in Telegram channels
 */
@Schema({
  timestamps: true,
  collection: 'TelegramChannelMembers',
  versionKey: false,
})
export class TelegramChannelMember extends Document {
  /**
   * The database ID of the channel membership record
   */
  @ApiProperty({
    description: 'The database ID of the channel membership record',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
    primaryKey: true,
  })
  _id: Types.ObjectId;

  /**
   * The operator's ID who is a member of the channel
   */
  @ApiProperty({
    description: 'The operator ID who is a member of the channel',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({ type: Types.ObjectId, ref: 'Operator', required: true, index: true })
  operatorId: Types.ObjectId;

  /**
   * The Telegram chat ID of the channel
   */
  @ApiProperty({
    description: 'The Telegram chat ID of the channel',
    example: '-1001234567890',
  })
  @Prop({ type: String, required: true, index: true })
  channelId: string;

  /**
   * The type of channel (public, private, etc.)
   */
  @ApiProperty({
    description: 'The type of channel',
    example: 'supergroup',
    enum: ['private', 'group', 'supergroup', 'channel'],
  })
  @Prop({ type: String, required: true })
  channelType: string;

  /**
   * The title/name of the channel
   */
  @ApiProperty({
    description: 'The title/name of the channel',
    example: 'HashLand Official',
  })
  @Prop({ type: String, required: true })
  channelTitle: string;

  /**
   * Whether the operator is currently a member of the channel
   */
  @ApiProperty({
    description: 'Whether the operator is currently a member of the channel',
    example: true,
  })
  @Prop({ type: Boolean, required: true, default: true })
  isMember: boolean;

  /**
   * When the membership was last verified
   */
  @ApiProperty({
    description: 'When the membership was last verified',
    example: '2024-03-19T12:00:00.000Z',
  })
  @Prop({ type: Date, required: true, default: Date.now })
  lastVerified: Date;

  /**
   * The timestamp when the record was created
   */
  @ApiProperty({
    description: 'The timestamp when the record was created',
    example: '2024-03-19T12:00:00.000Z',
  })
  createdAt: Date;

  /**
   * The timestamp when the record was last updated
   */
  @ApiProperty({
    description: 'The timestamp when the record was last updated',
    example: '2024-03-19T12:00:00.000Z',
  })
  updatedAt: Date;
}

/**
 * Generate the Mongoose schema for TelegramChannelMember
 */
export const TelegramChannelMemberSchema = SchemaFactory.createForClass(
  TelegramChannelMember,
);

// Create compound index for operatorId and channelId
TelegramChannelMemberSchema.index(
  { operatorId: 1, channelId: 1 },
  { unique: true },
);
