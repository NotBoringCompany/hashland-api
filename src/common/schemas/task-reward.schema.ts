import { Prop } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';

/**
 * `TaskRewards` defines the rewards for completing a task.
 */
export class TaskRewards {
  /**
   * The amount of fuel the operator will receive for completing the task.
   */
  @ApiProperty({
    description:
      'The amount of fuel the operator will receive for completing the task',
    example: 100,
  })
  @Prop({ required: true, default: 0 })
  fuel: number;
}
