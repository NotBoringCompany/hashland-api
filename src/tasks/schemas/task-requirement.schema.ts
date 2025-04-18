import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Types } from 'mongoose';

/**
 * Represents the type of a Task Requirement.
 */
export enum TaskRequirementType {
  JOIN_TELEGRAM_CHANNEL = 'Join Telegram Channel',
  COMPLETE_PROFILE = 'Complete Profile',
  DAILY_LOGIN = 'Daily Login',
  REFER_FRIEND = 'Refer Friend',
  REACH_LEVEL = 'Reach Level',
  VISIT_PAGE = 'Visit Page',
  COMPLETE_DRILL = 'Complete Drill Operation',
  ACCUMULATE_HASH = 'Accumulate HASH Tokens',
  ACCUMULATE_FUEL = 'Accumulate Fuel',
  PURCHASE_ITEM = 'Purchase Item',
}

/**
 * Represents the parameters of a Task Requirement.
 */
@Schema({ _id: false })
export class TaskRequirementParameters {
  /**
   * The Telegram channel ID
   */
  @ApiProperty({
    description: 'The Telegram channel ID',
    example: '-1001234567890',
    required: false,
  })
  @Prop({ type: String, required: false })
  channelId?: string;

  /**
   * The Telegram channel name
   */
  @ApiProperty({
    description: 'The Telegram channel name',
    example: 'HashLand Official',
    required: false,
  })
  @Prop({ type: String, required: false })
  channelName?: string;

  /**
   * The level to reach for level-based tasks
   */
  @ApiProperty({
    description: 'The level to reach',
    example: 5,
    required: false,
  })
  @Prop({ type: Number, required: false })
  level?: number;

  /**
   * The amount of HASH tokens to accumulate
   */
  @ApiProperty({
    description: 'The amount of HASH tokens to accumulate',
    example: 1000,
    required: false,
  })
  @Prop({ type: Number, required: false })
  hashAmount?: number;

  /**
   * The amount of fuel to accumulate
   */
  @ApiProperty({
    description: 'The amount of fuel to accumulate',
    example: 500,
    required: false,
  })
  @Prop({ type: Number, required: false })
  fuelAmount?: number;

  /**
   * The URL to visit for page visit tasks
   */
  @ApiProperty({
    description: 'The URL to visit',
    example: '/leaderboard',
    required: false,
  })
  @Prop({ type: String, required: false })
  pageUrl?: string;

  /**
   * The number of successful drill operations required
   */
  @ApiProperty({
    description: 'The number of successful drill operations required',
    example: 10,
    required: false,
  })
  @Prop({ type: Number, required: false })
  drillCount?: number;

  /**
   * The number of friends to refer
   */
  @ApiProperty({
    description: 'The number of friends to refer',
    example: 3,
    required: false,
  })
  @Prop({ type: Number, required: false })
  referralCount?: number;

  /**
   * The ID of the item to purchase
   */
  @ApiProperty({
    description: 'The ID of the item to purchase',
    example: '507f1f77bcf86cd799439011',
    required: false,
  })
  @Prop({ type: String, required: false })
  itemId?: string;
}

/**
 * Represents a single requirement of a Task.
 */
@Schema()
export class TaskRequirement {
  /**
   * The unique identifier for this requirement
   */
  @ApiProperty({
    description: 'The unique ID of the task requirement',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
  })
  _id: Types.ObjectId;

  /**
   * Type of the task requirement
   */
  @ApiProperty({
    description: 'Type of the task requirement',
    enum: TaskRequirementType,
    example: TaskRequirementType.JOIN_TELEGRAM_CHANNEL,
  })
  @Prop({
    type: String,
    enum: TaskRequirementType,
    required: true,
    index: true, // Add index for faster queries on requirement type
  })
  type: TaskRequirementType;

  /**
   * Task requirement description
   */
  @ApiProperty({
    description: 'Task requirement description',
    example: 'Join our official Telegram channel',
  })
  @Prop({ type: String, required: false })
  description?: string;

  /**
   * Parameters of the task requirement
   */
  @ApiProperty({
    description: 'Parameters of the task requirement',
    type: TaskRequirementParameters,
  })
  @Prop({
    type: TaskRequirementParameters,
    required: true,
  })
  parameters: TaskRequirementParameters;

  /**
   * Completion status (calculated at runtime)
   */
  @ApiProperty({
    description: 'Whether the requirement is completed',
    example: false,
  })
  completed?: boolean;
}
