import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Task } from './schemas/task.schema';
import { Model, Types } from 'mongoose';
import { ApiResponse } from 'src/common/dto/response.dto';
import { CompletedTask } from './schemas/completed-task.schema';
import { Operator } from 'src/operators/schemas/operator.schema';

@Injectable()
export class TaskService {
  constructor(
    @InjectModel(Task.name) private taskModel: Model<Task>,
    @InjectModel(CompletedTask.name)
    private completedTaskModel: Model<CompletedTask>,
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
  ) {}

  /**
   * Adds a new task to the database.
   */
  async addTask(
    name: string,
    description: string,
    maxCompletions: number,
  ): Promise<Types.ObjectId> {
    const task = await this.taskModel.create({
      name,
      description,
      maxCompletions,
    });

    return task._id;
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
        .findOne({ _id: taskId }, { timesCompleted: 1 })
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

      // If the completed task instance exists, increment the `timesCompleted` field by 1.
      // Otherwise, create a new completed task instance.
      if (completedTask) {
        await this.completedTaskModel.updateOne(
          { _id: taskId },
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
}
