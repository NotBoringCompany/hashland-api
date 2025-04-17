import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Schema for tracking Telegram webhook events
 */
@Schema({ timestamps: true, collection: 'TelegramWebhooks', versionKey: false })
export class TelegramWebhook extends Document {
  /**
   * The database ID of the webhook event
   */
  @ApiProperty({
    description: 'The database ID of the webhook event',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
    primaryKey: true,
  })
  _id: Types.ObjectId;

  /**
   * The update ID from Telegram
   */
  @ApiProperty({
    description: 'The update ID from Telegram',
    example: 123456789,
  })
  @Prop({ type: Number, required: true, unique: true, index: true })
  updateId: number;

  /**
   * The type of update event
   */
  @ApiProperty({
    description: 'The type of update event',
    example: 'message',
    enum: [
      'message',
      'edited_message',
      'channel_post',
      'edited_channel_post',
      'callback_query',
      'chat_join_request',
      'chat_member',
    ],
  })
  @Prop({ type: String, required: true, index: true })
  updateType: string;

  /**
   * The raw webhook payload from Telegram
   */
  @ApiProperty({
    description: 'The raw webhook payload from Telegram',
  })
  @Prop({ type: Object, required: true })
  payload: Record<string, any>;

  /**
   * Whether the webhook has been processed
   */
  @ApiProperty({
    description: 'Whether the webhook has been processed',
    example: false,
  })
  @Prop({ type: Boolean, required: true, default: false })
  processed: boolean;

  /**
   * Processing status message (if any)
   */
  @ApiProperty({
    description: 'Processing status message',
    example: 'Successfully processed callback query',
  })
  @Prop({ type: String, required: false })
  processingMessage?: string;
}

/**
 * Generate the Mongoose schema for TelegramWebhook
 */
export const TelegramWebhookSchema =
  SchemaFactory.createForClass(TelegramWebhook);
