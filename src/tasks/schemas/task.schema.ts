import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document, Types } from 'mongoose';
import { TaskRewards } from 'src/common/schemas/task-reward.schema';
import { TaskRequirement } from './task-requirement.schema';

/**
 * Requirements for a telegram channel join task
 */
export class TelegramChannelRequirement {
  /**
   * The Telegram channel ID
   */
  @ApiProperty({
    description: 'The Telegram channel ID',
    example: '-1001234567890',
  })
  @Prop({ type: String, required: true })
  channelId: string;

  /**
   * The name/title of the Telegram channel
   */
  @ApiProperty({
    description: 'The name/title of the Telegram channel',
    example: 'HashLand Official',
  })
  @Prop({ type: String, required: true })
  channelName: string;
}

/**
 * `Task` refers to a task that can be completed by a pool operator to earn rewards.
 */
@Schema({
  timestamps: false,
  collection: 'Tasks',
  versionKey: false,
})
export class Task extends Document {
  /**
   * The database ID of the pool operator.
   */
  @ApiProperty({
    description: 'The database ID of the pool operator',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
  })
  _id: Types.ObjectId;

  /**
   * The name of the task.
   */
  @ApiProperty({
    description: 'The name of the task',
    example: 'Clean the pool',
  })
  @Prop({
    type: String,
    required: true,
  })
  name: string;

  /**
   * The description of the task.
   */
  @ApiProperty({
    description: 'The description of the task',
    example: 'Vacuum the pool, skim the surface, and clean the filter',
  })
  @Prop({
    type: String,
    required: true,
  })
  description: string;

  /**
   * The amount of times this task can be completed.
   */
  @ApiProperty({
    description: 'The amount of times this task can be completed',
    example: 5,
  })
  @Prop({
    type: Number,
    required: true,
    default: 1,
  })
  maxCompletions: number;

  /**
   * The rewards for completing the task.
   */
  @ApiProperty({
    description: 'The rewards for completing the task',
    type: TaskRewards,
    required: true,
  })
  @Prop({
    type: TaskRewards,
    required: true,
  })
  rewards: TaskRewards;

  /**
   * The type of task
   */
  @ApiProperty({
    description: 'The type of task',
    example: 'telegram_channel_join',
    enum: ['basic', 'telegram_channel_join'],
  })
  @Prop({
    type: String,
    required: true,
    default: 'basic',
  })
  taskType: string;

  /**
   * Requirements for telegram channel join task type
   */
  @ApiProperty({
    description: 'Requirements for telegram channel join task',
    type: TelegramChannelRequirement,
    required: false,
  })
  @Prop({
    type: TelegramChannelRequirement,
    required: false,
  })
  telegramChannelRequirement?: TelegramChannelRequirement;

  /**
   * Array of task requirements
   */
  @ApiProperty({
    description: 'Array of task requirements',
    type: [TaskRequirement],
    required: false,
  })
  @Prop({
    type: [TaskRequirement],
    required: false,
  })
  requirements?: TaskRequirement[];
}

/**
 * Generate the Mongoose schema for Task.
 */
export const TaskSchema = SchemaFactory.createForClass(Task);
