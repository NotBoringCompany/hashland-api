import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document, Types } from 'mongoose';

/**
 * `CompletedTask` refers to a task that is completed by an operator.
 */
@Schema({
  timestamps: true,
  collection: 'CompletedTasks',
  versionKey: false,
})
export class CompletedTask extends Document {
  /**
   * The database ID of the task.
   *
   * This needs to be the same as the ID of the task in `Tasks`.
   */
  @ApiProperty({
    description: 'The database ID of the task',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
    index: true,
  })
  _id: Types.ObjectId;

  /**
   * The database ID of the operator.
   */
  @ApiProperty({
    description: 'The database ID of the operator',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    required: true,
    index: true,
  })
  operatorId: Types.ObjectId;

  /**
   * The number of times this task has been completed.
   */
  @ApiProperty({
    description: 'The number of times this task has been completed',
    example: 1,
  })
  @Prop({
    type: Number,
    required: true,
    default: 0,
  })
  timesCompleted: number;

  /**
   * Last time this task was completed
   */
  @ApiProperty({
    description: 'Last time this task was completed',
    example: '2023-01-01T00:00:00.000Z',
  })
  @Prop({
    type: Date,
    default: Date.now,
  })
  lastCompletedAt: Date;
}

/**
 * Generate the Mongoose schema for CompletedTask.
 */
export const CompletedTaskSchema = SchemaFactory.createForClass(CompletedTask);

// Create compound indexes
CompletedTaskSchema.index({ operatorId: 1, _id: 1 }, { unique: true }); // Each operator can complete a task only once (entry is updated with timesCompleted)
CompletedTaskSchema.index({ operatorId: 1, lastCompletedAt: -1 }); // For getting recent completions by operator
