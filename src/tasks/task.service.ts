import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Task } from './schemas/task.schema';
import { Model, Types } from 'mongoose';
import { ApiResponse } from 'src/common/dto/response.dto';
import { CompletedTask } from './schemas/completed-task.schema';
import { Operator } from 'src/operators/schemas/operator.schema';
import { TelegramService } from 'src/telegram/telegram.service';
import { TaskDto } from 'src/tasks/dto/task.dto';
import {
  TaskRequirement,
  TaskRequirementType,
} from './schemas/task-requirement.schema';

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
   * Adds a new task to the database with specified requirements.
   */
  async addTaskWithRequirements(
    name: string,
    description: string,
    maxCompletions: number,
    rewards: { fuel: number },
    requirements: TaskRequirement[],
  ): Promise<Types.ObjectId> {
    try {
      const task = await this.taskModel.create({
        name,
        description,
        maxCompletions,
        rewards,
        requirements,
      });

      return task._id;
    } catch (err) {
      throw new InternalServerErrorException(
        `(addTaskWithRequirements) Error creating task: ${err.message}`,
      );
    }
  }

  /**
   * Adds a basic task with no special requirements.
   */
  async addTask(
    name: string,
    description: string,
    maxCompletions: number,
    rewards: { fuel: number },
  ): Promise<Types.ObjectId> {
    // Create a task with empty requirements array
    return this.addTaskWithRequirements(
      name,
      description,
      maxCompletions,
      rewards,
      [],
    );
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
    try {
      // Create a task with a Telegram channel join requirement
      const telegramRequirement: TaskRequirement = {
        _id: new Types.ObjectId(),
        type: TaskRequirementType.JOIN_TELEGRAM_CHANNEL,
        description: `Join the ${channelName} Telegram channel`,
        parameters: {
          channelId,
          channelName,
        },
      };

      return this.addTaskWithRequirements(
        name,
        description,
        maxCompletions,
        rewards,
        [telegramRequirement],
      );
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
      const task = await this.taskModel
        .findOne({
          _id: taskId,
          isActive: true,
        })
        .lean();

      if (!task) {
        return new ApiResponse<null>(
          404,
          '(completeTask) Task not found or inactive.',
        );
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

      // Verify all requirements
      if (task.requirements && task.requirements.length > 0) {
        // Check if all requirements are met
        const requirementsMet = await this.verifyTaskRequirements(
          operatorId,
          task.requirements,
        );

        if (!requirementsMet) {
          return new ApiResponse<null>(
            400,
            '(completeTask) Task requirements are not met.',
          );
        }
      }

      // Update the current time for tracking
      const now = new Date();

      // If the completed task instance exists, increment the `timesCompleted` field by 1.
      // Otherwise, create a new completed task instance.
      if (completedTask) {
        await this.completedTaskModel.updateOne(
          { _id: taskId, operatorId },
          {
            $inc: { timesCompleted: 1 },
            $set: { lastCompletedAt: now },
          },
        );
      } else {
        await this.completedTaskModel.create({
          _id: taskId,
          operatorId,
          timesCompleted: 1,
          lastCompletedAt: now,
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
   * Verify all requirements for a task
   * @param operatorId The operator ID
   * @param requirements Array of task requirements to verify
   * @returns True if all requirements are met, false otherwise
   */
  private async verifyTaskRequirements(
    operatorId: Types.ObjectId,
    requirements: TaskRequirement[],
  ): Promise<boolean> {
    try {
      // Check each requirement
      for (const requirement of requirements) {
        let requirementMet = false;

        switch (requirement.type) {
          case TaskRequirementType.JOIN_TELEGRAM_CHANNEL:
            if (requirement.parameters?.channelId) {
              requirementMet = await this.verifyTelegramChannelMembership(
                operatorId,
                requirement.parameters.channelId,
              );
            }
            break;

          case TaskRequirementType.DAILY_LOGIN:
            // For daily login, we simply verify that the operator is active
            // This would typically be handled by the login system
            requirementMet = true;
            break;

          case TaskRequirementType.COMPLETE_PROFILE:
            // Check if operator has completed their profile
            const operator = await this.operatorModel
              .findOne({ _id: operatorId })
              .lean();
            requirementMet = !!operator; // Simplistic check - should be enhanced
            break;

          // Additional requirement types would be implemented here
          default:
            // For unimplemented requirement types, default to false
            requirementMet = false;
        }

        if (!requirementMet) {
          return false; // If any requirement is not met, return false
        }
      }

      return true; // All requirements are met
    } catch (err) {
      throw new InternalServerErrorException(
        `Error verifying task requirements: ${err.message}`,
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
        .sort({ lastCompletedAt: -1 }) // Sort by most recently completed
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
    taskDto.requirements = task.requirements;

    // If userId is provided, check if user has completed the task
    if (userId) {
      const completedTask = await this.completedTaskModel.findOne({
        _id: task._id,
        operatorId: userId,
      });

      taskDto.completed = !!completedTask;
    }

    return taskDto;
  }
}
