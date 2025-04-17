import { Prop, Schema } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Represents the type of a Task Requirement.
 */
export enum TaskRequirementType {
  JOIN_TELEGRAM_CHANNEL = 'Join Telegram Channel',
  BASIC = 'Basic',
}

/**
 * Represents the parameters of a Task Requirement.
 */
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
}

/**
 * Progress information for a task requirement
 */
export class TaskRequirementProgress {
  /**
   * Whether the requirement has been completed
   */
  @ApiProperty({
    description: 'Whether the requirement has been completed',
    example: true,
  })
  @Prop({ type: Boolean, required: true, default: false })
  completed: boolean;

  /**
   * Last verification timestamp
   */
  @ApiProperty({
    description: 'Last verification timestamp',
    example: '2023-01-01T00:00:00.000Z',
  })
  @Prop({ type: Date, required: false })
  lastVerified?: Date;
}

/**
 * Represents a single requirement of a Task.
 */
@Schema({ _id: false })
export class TaskRequirement {
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
  @Prop({ type: TaskRequirementParameters, required: true })
  parameters: TaskRequirementParameters;

  /**
   * Progress information (only used for fetching task details)
   */
  @ApiProperty({
    description: 'Progress information',
    type: TaskRequirementProgress,
    required: false,
  })
  @Prop({ type: TaskRequirementProgress, required: false })
  progress?: TaskRequirementProgress;
}
