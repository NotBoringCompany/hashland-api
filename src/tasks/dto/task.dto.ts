import { ApiProperty } from '@nestjs/swagger';
import { TaskRewards } from 'src/common/schemas/task-reward.schema';
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
    example: 'Join our Telegram channel',
  })
  name: string;

  /**
   * Task description
   */
  @ApiProperty({
    description: 'Task description',
    example: 'Join our official Telegram channel to receive news and updates',
  })
  description: string;

  /**
   * Maximum times the task can be completed
   */
  @ApiProperty({
    description: 'Maximum times the task can be completed',
    example: 1,
  })
  maxCompletions: number;

  /**
   * Task rewards
   */
  @ApiProperty({
    description: 'Task rewards',
    type: TaskRewards,
  })
  rewards: TaskRewards;

  /**
   * Task type
   */
  @ApiProperty({
    description: 'Task type',
    example: 'telegram_channel_join',
  })
  taskType: string;

  /**
   * Whether the task has been completed by the user
   */
  @ApiProperty({
    description: 'Whether the task has been completed by the user',
    example: false,
  })
  completed?: boolean;

  /**
   * Task requirements
   */
  @ApiProperty({
    description: 'Task requirements',
    type: [TaskRequirement],
  })
  requirements?: TaskRequirement[];
}
