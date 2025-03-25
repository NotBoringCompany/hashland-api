import { Controller, Get, Post, Query, Param } from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiParam,
} from '@nestjs/swagger';
import { ApiResponse as AppApiResponse } from 'src/common/dto/response.dto';
import { TaskService } from './task.service';
import {
  CompleteTaskResponseDto,
  GetCompletedTasksResponseDto,
  GetTasksResponseDto,
} from 'src/common/dto/task.dto';
import { Task } from './schemas/task.schema';
import { CompletedTask } from './schemas/completed-task.schema';
import { Types } from 'mongoose';
import {
  CompleteTaskParamsDto,
  GetCompletedTasksParamsDto,
  GetTasksQueryDto,
} from 'src/common/dto/task-request.dto';

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
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid projection format',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  @ApiQuery({
    name: 'projection',
    required: false,
    description: 'Comma-separated list of fields to include in the response',
    type: String,
    example: 'name,description,rewards',
  })
  @Get()
  async getTasks(
    @Query() query: GetTasksQueryDto,
  ): Promise<AppApiResponse<{ tasks: Partial<Task[]> }>> {
    // Convert query string to Mongoose projection object
    const projectionObj = query.projection
      ? query.projection
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
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid operator ID format',
  })
  @ApiResponse({
    status: 404,
    description: 'Operator not found or has no completed tasks',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  @ApiParam({
    name: 'operatorId',
    required: true,
    description: 'MongoDB ObjectId of the operator',
    type: String,
    example: '507f1f77bcf86cd799439011',
  })
  @Get('operators/:operatorId/completed')
  async getCompletedTasks(
    @Param() params: GetCompletedTasksParamsDto,
  ): Promise<AppApiResponse<{ completedTasks: Partial<CompletedTask[]> }>> {
    return await this.taskService.getCompletedTasks(
      new Types.ObjectId(params.operatorId),
    );
  }

  @ApiOperation({
    summary: 'Complete a task',
    description: 'Increment the amount of times a task has been completed.',
  })
  @ApiResponse({
    status: 200,
    description: 'Task completed successfully',
    type: CompleteTaskResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid task ID or operator ID format',
  })
  @ApiResponse({
    status: 404,
    description: 'Task or operator not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Task already completed maximum number of times',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  @ApiParam({
    name: 'taskId',
    required: true,
    description: 'MongoDB ObjectId of the task',
    type: String,
    example: '507f1f77bcf86cd799439011',
  })
  @ApiParam({
    name: 'operatorId',
    required: true,
    description: 'MongoDB ObjectId of the operator',
    type: String,
    example: '507f1f77bcf86cd799439011',
  })
  @Post(':taskId/complete/:operatorId')
  async completeTask(@Param() params: CompleteTaskParamsDto): Promise<
    AppApiResponse<{
      completedTaskId: Types.ObjectId;
    }>
  > {
    return this.taskService.completeTask(
      new Types.ObjectId(params.taskId),
      new Types.ObjectId(params.operatorId),
    );
  }
}
