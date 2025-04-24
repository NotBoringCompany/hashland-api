import { ApiProperty } from '@nestjs/swagger';
import { TaskReward } from '../schemas/task.schema';
import { TaskRequirement } from '../schemas/task-requirement.schema';

/**
 * Data transfer object for task details
 */
export class TaskDto {
  /**
   * Task ID
   */
  @ApiProperty({
    description: 'Task ID',
    example: '507f1f77bcf86cd799439011',
  })
  id: string;

  /**
   * Task name
   */
  @ApiProperty({
    description: 'Task name',
    example: 'Clean the pool',
  })
  name: string;

  /**
   * Task description
   */
  @ApiProperty({
    description: 'Task description',
    example: 'Vacuum the pool, skim the surface, and clean the filter',
  })
  description: string;

  /**
   * Maximum number of times this task can be completed
   */
  @ApiProperty({
    description: 'Maximum number of times this task can be completed',
    example: 5,
  })
  maxCompletions: number;

  /**
   * Whether the task has been completed by the user
   */
  @ApiProperty({
    description: 'Whether the task has been completed by the user',
    example: false,
  })
  completed?: boolean;

  /**
   * The rewards for completing the task
   */
  @ApiProperty({
    description: 'The rewards for completing the task',
    type: [TaskReward],
  })
  rewards: TaskReward[];

  /**
   * Array of task requirements
   */
  @ApiProperty({
    description: 'Array of task requirements',
    type: [TaskRequirement],
  })
  requirements: TaskRequirement[];
}
