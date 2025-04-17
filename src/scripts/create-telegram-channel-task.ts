/**
 * Script to create a Telegram channel join task
 *
 * Usage:
 * npx ts-node -r tsconfig-paths/register src/scripts/create-telegram-channel-task.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TaskService } from '../tasks/task.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const taskService = app.get(TaskService);

  try {
    // Configure your task parameters here
    const taskName = 'Join HashLand Official Telegram Channel';
    const taskDescription =
      'Join our official Telegram channel to receive news and updates about HashLand.';
    const maxCompletions = 1; // Can only be completed once
    const fuelReward = 100; // Reward 100 fuel units
    const channelId = '-1001234567890'; // Replace with your actual channel ID
    const channelName = 'HashLand Official'; // Replace with your actual channel name

    const taskId = await taskService.addTelegramChannelJoinTask(
      taskName,
      taskDescription,
      maxCompletions,
      { fuel: fuelReward },
      channelId,
      channelName,
    );

    console.log(
      `✅ Telegram channel join task created successfully! Task ID: ${taskId}`,
    );
  } catch (error) {
    console.error('❌ Error creating task:', error.message);

    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  } finally {
    await app.close();
  }
}

bootstrap();
