import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document, Types } from 'mongoose';
import { TaskRewards } from 'src/common/schemas/task-reward.schema';
import { TaskRequirement } from './task-requirement.schema';

/**
 * `Task` refers to a task that can be completed by a pool operator to earn rewards.
 */
@Schema({
  timestamps: true,
  collection: 'Tasks',
  versionKey: false,
})
export class Task extends Document {
  /**
   * The database ID of the task.
   */
  @ApiProperty({
    description: 'The database ID of the task',
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
    index: true,
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
    index: true,
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
   * Array of task requirements
   */
  @ApiProperty({
    description: 'Array of task requirements',
    type: [TaskRequirement],
    required: true,
  })
  @Prop({
    type: [TaskRequirement],
    required: true,
    default: [],
  })
  requirements: TaskRequirement[];

  /**
   * Whether the task is active
   */
  @ApiProperty({
    description: 'Whether the task is active',
    example: true,
  })
  @Prop({
    type: Boolean,
    default: true,
    index: true,
  })
  isActive: boolean;

  /**
   * Whether the task is hidden from users
   * Hidden tasks won't appear in general task lists but can still be accessed directly.
   * Useful for special tasks that should only be accessible through specific routes or for specific users.
   */
  @ApiProperty({
    description: 'Whether the task is hidden from general task lists',
    example: false,
  })
  @Prop({
    type: Boolean,
    default: false,
    index: true,
  })
  hidden: boolean;
}

/**
 * Generate the Mongoose schema for Task.
 */
export const TaskSchema = SchemaFactory.createForClass(Task);

// Create compound indexes
TaskSchema.index({ isActive: 1, maxCompletions: 1 });
TaskSchema.index({ isActive: 1, hidden: 1 });
