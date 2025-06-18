import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationPreference } from '../schemas/notification-preference.schema';

/**
 * Service for managing notification preferences
 */
@Injectable()
export class NotificationPreferenceService {
  private readonly logger = new Logger(NotificationPreferenceService.name);

  constructor(
    @InjectModel(NotificationPreference.name)
    private readonly preferenceModel: Model<NotificationPreference>,
  ) {}

  /**
   * Create notification preferences for a user
   */
  async create(
    createPreferenceData: Partial<NotificationPreference>,
  ): Promise<NotificationPreference> {
    try {
      const preference = new this.preferenceModel(createPreferenceData);
      const savedPreference = await preference.save();

      this.logger.log(
        `Notification preferences created for user: ${createPreferenceData.userId}`,
      );
      return savedPreference;
    } catch (error) {
      this.logger.error(
        `Failed to create notification preferences: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find notification preferences by user ID
   */
  async findByUserId(
    userId: Types.ObjectId,
  ): Promise<NotificationPreference | null> {
    try {
      return await this.preferenceModel.findOne({ userId }).exec();
    } catch (error) {
      this.logger.error(
        `Failed to find notification preferences: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update notification preferences
   */
  async update(
    userId: Types.ObjectId,
    updateData: Partial<NotificationPreference>,
  ): Promise<NotificationPreference | null> {
    try {
      const updatedPreference = await this.preferenceModel
        .findOneAndUpdate({ userId }, updateData, { new: true })
        .exec();

      if (updatedPreference) {
        this.logger.log(`Notification preferences updated for user: ${userId}`);
      }

      return updatedPreference;
    } catch (error) {
      this.logger.error(
        `Failed to update notification preferences: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete notification preferences
   */
  async delete(userId: Types.ObjectId): Promise<void> {
    try {
      const result = await this.preferenceModel.deleteOne({ userId }).exec();

      if (result.deletedCount > 0) {
        this.logger.log(`Notification preferences deleted for user: ${userId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete notification preferences: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
