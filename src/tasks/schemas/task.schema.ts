import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document, Types } from 'mongoose';
import { TaskRewards } from 'src/common/schemas/task-reward.schema';

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

  // TO DO: ADD REQUIREMENTS TO TASK.
}

/**
 * Generate the Mongoose schema for Task.
 */
export const TaskSchema = SchemaFactory.createForClass(Task);
