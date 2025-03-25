import { ApiProperty } from '@nestjs/swagger';
import { CompletedTask } from 'src/tasks/schemas/completed-task.schema';
import { Task } from 'src/tasks/schemas/task.schema';
import { Types } from 'mongoose';
import { ApiResponse } from './response.dto';

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

export class CompleteTaskData {
  @ApiProperty({
    description: 'The MongoDB ObjectId of the completed task',
    example: '507f1f77bcf86cd799439011',
  })
  completedTaskId: Types.ObjectId;
}

export class CompleteTaskResponseDto extends ApiResponse<CompleteTaskData> {
  @ApiProperty({
    description: 'Task completion data',
    type: CompleteTaskData,
  })
  data: CompleteTaskData;
}
