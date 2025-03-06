import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationType } from '../notification.interface';

/**
 * Service that bridges between the scheduler and the notification system
 * This service listens for cycle updates and other scheduled events
 * and translates them into operator-specific notifications
 */
@Injectable()
export class SchedulerBridgeService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerBridgeService.name);

  constructor(private readonly notificationService: NotificationService) { }

  onModuleInit() {
    this.logger.log('Scheduler Bridge Service initialized');
    // Subscribe to any event emitters or message queues here
  }

  /**
   * Process a drilling cycle update and send notifications to relevant operators
   */
  processCycleUpdate(cycleData: any): void {
    try {
      this.logger.debug(
        `Processing cycle update: ${JSON.stringify(cycleData)}`,
      );

      // Example: Broadcast cycle progress to all operators
      if (cycleData.cycleProgress !== undefined) {
        this.notificationService.broadcastToAll({
          type: NotificationType.DRILLING,
          title: 'Drilling Cycle Update',
          message: `Cycle progress: ${cycleData.cycleProgress}%`,
          data: {
            cycleId: cycleData.cycleId,
            progress: cycleData.cycleProgress,
            timestamp: cycleData.timestamp,
          },
          timestamp: new Date(),
        });
      }

      // Example: Send personalized notifications to top miners
      if (cycleData.topMiners && Array.isArray(cycleData.topMiners)) {
        cycleData.topMiners.forEach((miner) => {
          this.notificationService.sendToOperator(miner.operatorId, {
            type: NotificationType.SUCCESS,
            title: 'Mining Performance Update',
            message: `You've mined ${miner.hashMined} hash in the current cycle!`,
            data: {
              cycleId: cycleData.cycleId,
              hashMined: miner.hashMined,
              timestamp: cycleData.timestamp,
            },
            timestamp: new Date(),
          });
        });
      }
    } catch (error) {
      this.logger.error(
        `Error processing cycle update: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Process a cycle completion event
   */
  processCycleCompletion(cycleData: any): void {
    try {
      this.logger.log(
        `Processing cycle completion for cycle: ${cycleData.cycleId}`,
      );

      // Broadcast to all operators
      this.notificationService.broadcastSystemNotification(
        'Drilling Cycle Completed',
        `Cycle ${cycleData.cycleId} has been completed successfully.`,
        {
          cycleId: cycleData.cycleId,
          totalHashMined: cycleData.totalHashMined,
          completedAt: new Date(),
        },
      );

      // Notify top performers individually
      if (cycleData.topMiners && Array.isArray(cycleData.topMiners)) {
        // Sort miners by hash mined (descending)
        const sortedMiners = [...cycleData.topMiners].sort(
          (a, b) => b.hashMined - a.hashMined,
        );

        // Notify top 3 miners
        sortedMiners.slice(0, 3).forEach((miner, index) => {
          const rank = index + 1;
          this.notificationService.sendToOperator(miner.operatorId, {
            type: NotificationType.SUCCESS,
            title: `Congratulations! Rank #${rank} Miner`,
            message: `You ranked #${rank} in cycle ${cycleData.cycleId} with ${miner.hashMined} hash mined!`,
            data: {
              cycleId: cycleData.cycleId,
              rank,
              hashMined: miner.hashMined,
              completedAt: new Date(),
            },
            timestamp: new Date(),
          });
        });
      }
    } catch (error) {
      this.logger.error(
        `Error processing cycle completion: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Process system maintenance notifications
   */
  processSystemMaintenance(maintenanceData: any): void {
    try {
      const { startTime, endTime, description } = maintenanceData;

      this.notificationService.broadcastSystemNotification(
        'Scheduled Maintenance',
        `System maintenance scheduled from ${startTime} to ${endTime}: ${description}`,
        maintenanceData,
      );
    } catch (error) {
      this.logger.error(
        `Error processing system maintenance: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Process operator-specific events (e.g., rewards, achievements)
   */
  processOperatorEvent(operatorId: string, eventData: any): void {
    try {
      const { eventType, details } = eventData;

      switch (eventType) {
        case 'reward':
          this.notificationService.sendToOperator(operatorId, {
            type: NotificationType.SUCCESS,
            title: 'Reward Earned',
            message: `You've earned a reward: ${details.rewardName}`,
            data: details,
            timestamp: new Date(),
          });
          break;

        case 'achievement':
          this.notificationService.sendToOperator(operatorId, {
            type: NotificationType.SUCCESS,
            title: 'Achievement Unlocked',
            message: `New achievement: ${details.achievementName}`,
            data: details,
            timestamp: new Date(),
          });
          break;

        default:
          this.logger.warn(`Unknown operator event type: ${eventType}`);
      }
    } catch (error) {
      this.logger.error(
        `Error processing operator event: ${error.message}`,
        error.stack,
      );
    }
  }
}
