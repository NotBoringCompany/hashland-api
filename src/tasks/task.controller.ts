import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiResponse as AppApiResponse } from 'src/common/dto/response.dto';
import { TaskService } from './task.service';
import {
  GetCompletedTasksResponseDto,
  GetTasksResponseDto,
} from 'src/common/dto/task.dto';
import { Task } from './schemas/task.schema';
import { CompletedTask } from './schemas/completed-task.schema';
import { Types } from 'mongoose';

@ApiTags('Tasks')
@Controller('tasks') // Base route: `/tasks`
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @ApiOperation({
    summary: 'Get all tasks',
    description: 'Fetches all available tasks with optional field projection',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved tasks',
    type: GetTasksResponseDto,
  })
  @Get()
  async getTasks(
    @Query('projection') projection?: string,
  ): Promise<AppApiResponse<{ tasks: Partial<Task[]> }>> {
    // Convert query string to Mongoose projection object
    const projectionObj = projection
      ? projection
          .split(',')
          .reduce((acc, field) => ({ ...acc, [field]: 1 }), {})
      : undefined;

    return this.taskService.getTasks(projectionObj);
  }

  @ApiOperation({
    summary: 'Get completed tasks',
    description:
      'Get a list of tasks the operator has completed at least once.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved completed tasks',
    type: GetCompletedTasksResponseDto,
  })
  @Get('get-completed')
  async getCompletedTasks(
    @Query('operatorId') operatorId: string,
  ): Promise<AppApiResponse<{ completedTasks: Partial<CompletedTask[]> }>> {
    return await this.taskService.getCompletedTasks(
      new Types.ObjectId(operatorId),
    );
  }

  @ApiOperation({
    summary: 'Complete a task',
    description: 'Increment the amount of times a task has been completed.',
  })
  @ApiResponse({
    status: 200,
    description: 'Task completed successfully',
  })
  @Post('complete')
  async completeTask(
    @Query('taskId') taskId: string,
    @Query('operatorId') operatorId: string,
  ): Promise<
    AppApiResponse<{
      completedTaskId: Types.ObjectId;
    }>
  > {
    return this.taskService.completeTask(
      new Types.ObjectId(taskId),
      new Types.ObjectId(operatorId),
    );
  }
}
