import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Operator,
  OperatorSchema,
} from 'src/operators/schemas/operator.schema';
import { Task, TaskSchema } from './schemas/task.schema';
import {
  CompletedTask,
  CompletedTaskSchema,
} from './schemas/completed-task.schema';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { TelegramModule } from 'src/telegram/telegram.module';
import { DrillingGatewayModule } from 'src/gateway/drilling.gateway.module';
import { MixpanelModule } from 'src/mixpanel/mixpanel.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: CompletedTask.name, schema: CompletedTaskSchema },
      { name: Operator.name, schema: OperatorSchema },
    ]),
    TelegramModule,
    DrillingGatewayModule,
    MixpanelModule,
  ],
  controllers: [TaskController],
  providers: [TaskService],
  exports: [MongooseModule, TaskService],
})
export class TaskModule {}
