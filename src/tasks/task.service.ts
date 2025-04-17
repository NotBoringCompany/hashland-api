import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Task, TelegramChannelRequirement } from './schemas/task.schema';
import { Model, Types } from 'mongoose';
import { ApiResponse } from 'src/common/dto/response.dto';
import { CompletedTask } from './schemas/completed-task.schema';
import { Operator } from 'src/operators/schemas/operator.schema';
import { TelegramService } from 'src/telegram/telegram.service';
import { TaskDto } from 'src/tasks/dto/task.dto';
import { TaskRequirementType } from './schemas/task-requirement.schema';

@Injectable()
export class TaskService {
  constructor(
    @InjectModel(Task.name) private taskModel: Model<Task>,
    @InjectModel(CompletedTask.name)
    private completedTaskModel: Model<CompletedTask>,
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
    private readonly telegramService: TelegramService,
  ) {}

  /**
   * Adds a new task to the database.
   */
  async addTask(
    name: string,
    description: string,
    maxCompletions: number,
    rewards: { fuel: number },
  ): Promise<Types.ObjectId> {
    const task = await this.taskModel.create({
      name,
      description,
      maxCompletions,
      rewards,
      taskType: 'basic',
    });

    return task._id;
  }

  /**
   * Adds a new Telegram channel join task
   */
  async addTelegramChannelJoinTask(
    name: string,
    description: string,
    maxCompletions: number,
    rewards: { fuel: number },
    channelId: string,
    channelName: string,
  ): Promise<Types.ObjectId> {
    // Verify that the channel exists and is valid
    try {
      // You might want to validate channel existence with the Telegram API
      const requirement: TelegramChannelRequirement = {
        channelId,
        channelName,
      };

      const task = await this.taskModel.create({
        name,
        description,
        maxCompletions,
        rewards,
        taskType: 'telegram_channel_join',
        telegramChannelRequirement: requirement,
      });

      return task._id;
    } catch (err) {
      throw new InternalServerErrorException(
        `(addTelegramChannelJoinTask) Error creating task: ${err.message}`,
      );
    }
  }

  /**
   * Fetches all tasks. Optional projection to filter out fields.
   */
  async getTasks(
    projection?: string | Record<string, 1 | 0>,
  ): Promise<ApiResponse<{ tasks: Task[] }>> {
    const tasks = await this.taskModel.find({}).select(projection).lean();

    return new ApiResponse<{ tasks: Task[] }>(200, 'Tasks fetched.', {
      tasks,
    });
  }

  /**
   * Complete a task.
   */
  async completeTask(
    taskId: Types.ObjectId,
    operatorId: Types.ObjectId,
  ): Promise<
    ApiResponse<{
      completedTaskId: Types.ObjectId;
    }>
  > {
    try {
      const task = await this.taskModel.findOne({ _id: taskId }).lean();

      if (!task) {
        return new ApiResponse<null>(404, '(completeTask) Task not found.');
      }

      // Check number of completions for this task
      const completedTask = await this.completedTaskModel
        .findOne({ _id: taskId, operatorId }, { timesCompleted: 1 })
        .lean();

      if (
        completedTask &&
        completedTask.timesCompleted >= task.maxCompletions
      ) {
        return new ApiResponse<null>(
          400,
          '(completeTask) Task has reached maximum completions.',
        );
      }

      // Handle task-specific requirements
      if (task.taskType === 'telegram_channel_join') {
        if (!task.telegramChannelRequirement) {
          return new ApiResponse<null>(
            400,
            '(completeTask) Invalid telegram channel join task configuration.',
          );
        }

        // Verify the operator is a member of the required channel
        const verified = await this.verifyTelegramChannelMembership(
          operatorId,
          task.telegramChannelRequirement.channelId,
        );

        if (!verified) {
          return new ApiResponse<null>(
            400,
            '(completeTask) Operator is not a member of the required channel.',
          );
        }
      }

      // If the completed task instance exists, increment the `timesCompleted` field by 1.
      // Otherwise, create a new completed task instance.
      if (completedTask) {
        await this.completedTaskModel.updateOne(
          { _id: taskId, operatorId },
          {
            $inc: { timesCompleted: 1 },
          },
        );
      } else {
        await this.completedTaskModel.create({
          _id: taskId,
          operatorId,
          timesCompleted: 1,
        });
      }

      // Give the operator the rewards for completing the task
      if (task.rewards.fuel > 0) {
        const operator = await this.operatorModel
          .findOne({ _id: operatorId }, { currentFuel: 1, maxFuel: 1 })
          .lean();

        if (!operator) {
          return new ApiResponse<null>(
            404,
            '(completeTask) Operator not found.',
          );
        }

        // Update the operator's fuel amount (limit at `maxFuel`)
        const fuelToInc = Math.min(
          task.rewards.fuel,
          operator.maxFuel - operator.currentFuel,
        );

        await this.operatorModel.updateOne(
          { _id: operatorId },
          {
            $inc: { currentFuel: fuelToInc },
          },
        );
      }

      return new ApiResponse<{ completedTaskId: Types.ObjectId }>(
        200,
        '(completeTask) Task completed.',
        {
          completedTaskId: taskId,
        },
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(completeTask) Error completing task: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Get a list of tasks the operator has completed at least once.
   */
  async getCompletedTasks(
    operatorId: Types.ObjectId,
  ): Promise<ApiResponse<{ completedTasks: CompletedTask[] }>> {
    try {
      const completedTasks = await this.completedTaskModel
        .find({ operatorId, timesCompleted: { $gt: 0 } })
        .lean();

      return new ApiResponse<{ completedTasks: CompletedTask[] }>(
        200,
        'Completed tasks fetched.',
        { completedTasks },
      );
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(getCompletedTasks) Error fetching completed tasks: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Verify if an operator is a member of a specified Telegram channel
   * @param operatorId The operator ID
   * @param channelId The Telegram channel ID
   * @returns True if the operator is a member of the channel, false otherwise
   */
  private async verifyTelegramChannelMembership(
    operatorId: Types.ObjectId,
    channelId: string,
  ): Promise<boolean> {
    try {
      // Find the operator to get their Telegram ID
      const operator = await this.operatorModel
        .findOne({ _id: operatorId }, { 'tgProfile.tgId': 1 })
        .lean();

      if (!operator || !operator.tgProfile) {
        throw new NotFoundException(
          'Operator not found or has no Telegram profile',
        );
      }

      const tgUserId = operator.tgProfile.tgId;

      // Check if the operator is a member of the channel
      const membershipResponse =
        await this.telegramService.checkChannelMembership({
          userId: tgUserId,
          channelId,
        });

      return membershipResponse.isMember;
    } catch (err) {
      throw new InternalServerErrorException(
        `Error verifying channel membership: ${err.message}`,
      );
    }
  }

  async getTaskDetails(taskId: string, userId?: string): Promise<TaskDto> {
    const task = await this.taskModel.findOne({ _id: taskId }).lean();

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const taskDto = new TaskDto();
    taskDto.id = task._id.toString();
    taskDto.name = task.name;
    taskDto.description = task.description;
    taskDto.maxCompletions = task.maxCompletions;
    taskDto.rewards = task.rewards;
    taskDto.taskType = task.taskType;

    // If userId is provided, check if user has completed the task
    if (userId) {
      const completedTask = await this.completedTaskModel.findOne({
        taskId: task._id,
        userId,
      });

      taskDto.completed = !!completedTask;

      // If task has requirements, update their progress
      if (task.requirements && task.requirements.length > 0) {
        await Promise.all(
          task.requirements.map(async (requirement) => {
            // Initialize progress if not present
            if (!requirement.progress) {
              requirement.progress = {
                completed: false,
              };
            }

            // Verify each requirement type
            switch (requirement.type) {
              case TaskRequirementType.JOIN_TELEGRAM_CHANNEL:
                if (requirement.parameters?.channelId) {
                  // Check if user is a member of the Telegram channel
                  // This will need to be implemented based on your Telegram integration
                  // For now, set as not completed
                  requirement.progress.completed = false;
                  requirement.progress.lastVerified = new Date();
                }
                break;
              default:
                // For other requirement types, no specific verification needed
                break;
            }
          }),
        );
      }
    }

    return taskDto;
  }
}
