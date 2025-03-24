import { ApiProperty } from '@nestjs/swagger';
import { CompletedTask } from 'src/tasks/schemas/completed-task.schema';
import { Task } from 'src/tasks/schemas/task.schema';

export class GetTasksResponseDto {
  @ApiProperty({
    description: 'Array of tasks',
    type: [Task],
  })
  tasks: Partial<Task[]>;
}

export class GetCompletedTasksResponseDto {
  @ApiProperty({
    description: 'Array of completed tasks',
    type: [CompletedTask],
  })
  completedTasks: Partial<CompletedTask[]>;
}
