import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { TelegramChannelMember } from './schemas/telegram-channel-member.schema';
import { TelegramWebhook } from './schemas/telegram-webhook.schema';
import {
  ChannelMembershipResponseDto,
  CheckChannelMembershipDto,
} from './dto/telegram-webhook.dto';
import axios from 'axios';
import { ApiResponse } from 'src/common/dto/response.dto';
import { OperatorService } from 'src/operators/operator.service';
import { Operator } from 'src/operators/schemas/operator.schema';
import { ReferralService } from 'src/referral/referral.service';

/**
 * Service for managing Telegram-related functionality
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly apiBaseUrl: string;
  private readonly hashlandUrl: string;

  constructor(
    private configService: ConfigService,
    private operatorService: OperatorService,
    @InjectModel(TelegramChannelMember.name)
    private channelMemberModel: Model<TelegramChannelMember>,
    @InjectModel(TelegramWebhook.name)
    private webhookModel: Model<TelegramWebhook>,
    private referralService: ReferralService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!this.botToken) {
      throw new Error(
        'TELEGRAM_BOT_TOKEN is not defined in environment variables',
      );
    }
    this.apiBaseUrl = `https://api.telegram.org/bot${this.botToken}`;

    this.hashlandUrl = this.configService.get<string>('HASHLAND_URL');
    if (!this.hashlandUrl) {
      this.logger.warn('HASHLAND_URL is not defined in environment variables');
    }
  }

  /**
   * Process a webhook update from Telegram
   * @param update - The update object from Telegram
   * @returns Information about the processed update
   */
  async processWebhook(
    update: Record<string, any>,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.debug(update);

    try {
      const updateId = update.update_id;

      // Check if we've already processed this update
      const existingUpdate = await this.webhookModel.findOne({ updateId });
      if (existingUpdate && existingUpdate.processed) {
        return { success: true, message: 'Update already processed' };
      }

      // Determine update type
      let updateType = 'unknown';
      if (update.message) updateType = 'message';
      else if (update.edited_message) updateType = 'edited_message';
      else if (update.channel_post) updateType = 'channel_post';
      else if (update.edited_channel_post) updateType = 'edited_channel_post';
      else if (update.callback_query) updateType = 'callback_query';
      else if (update.chat_join_request) updateType = 'chat_join_request';
      else if (update.chat_member) updateType = 'chat_member';

      // Save or update the webhook record
      const webhookRecord =
        existingUpdate ||
        new this.webhookModel({
          updateId,
          updateType,
          payload: update,
          processed: false,
        });

      // Process the update based on type
      let processingMessage = '';

      if (updateType === 'chat_member') {
        // Process channel membership updates
        processingMessage = await this.processChannelMemberUpdate(update);
      } else if (updateType === 'message') {
        // Process direct messages to the bot
        processingMessage = await this.processMessageUpdate(update);
      } else {
        processingMessage = `Received ${updateType} update`;
      }

      // Mark as processed
      webhookRecord.processed = true;
      webhookRecord.processingMessage = processingMessage;
      await webhookRecord.save();

      this.logger.log(
        `Processed webhook update ${updateId}: ${processingMessage}`,
      );
      return { success: true, message: processingMessage };
    } catch (error) {
      this.logger.error(
        `Error processing webhook: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        new ApiResponse(500, `Error processing webhook: ${error.message}`),
      );
    }
  }

  /**
   * Process channel membership update events
   * @param update - The chat_member update from Telegram
   * @returns Status message about the processing result
   */
  private async processChannelMemberUpdate(
    update: Record<string, any>,
  ): Promise<string> {
    try {
      const chatMember = update.chat_member;
      const chat = chatMember.chat;
      const userId = chatMember.from.id?.toString();

      if (!userId) {
        return 'Invalid chat_member update: missing user ID';
      }

      // Check if this is a channel membership update
      if (!['channel', 'supergroup'].includes(chat.type)) {
        return `Ignoring membership update for non-channel chat type: ${chat.type}`;
      }

      // Find the operator by Telegram ID
      const operatorExists = await this.isValidOperator(userId);
      if (!operatorExists.exists) {
        return `No operator found with Telegram ID: ${userId}`;
      }

      const operatorId = operatorExists.operatorId;
      const channelId = chat.id?.toString();

      // Check current membership status
      const newStatus = ['member', 'administrator', 'creator'].includes(
        chatMember.new_chat_member?.status,
      );

      // Update or create membership record
      await this.channelMemberModel.findOneAndUpdate(
        { operatorId, channelId },
        {
          $set: {
            operatorId,
            channelId,
            channelType: chat.type,
            channelTitle: chat.title || `Chat ${channelId}`,
            isMember: newStatus,
            lastVerified: new Date(),
          },
        },
        { upsert: true, new: true },
      );

      return `Updated membership for operator ${operatorId} in channel ${chat.title}: ${newStatus ? 'Joined' : 'Left'}`;
    } catch (error) {
      this.logger.error(
        `Error processing channel member update: ${error.message}`,
        error.stack,
      );
      return `Error processing channel member update: ${error.message}`;
    }
  }

  /**
   * Process direct message updates to the bot
   * @param update - The message update from Telegram
   * @returns Status message about the processing result
   */
  private async processMessageUpdate(
    update: Record<string, any>,
  ): Promise<string> {
    // Basic message handling - can be expanded as needed
    const message = update.message;
    const chatId = message.chat.id;
    const userId = message.from?.id?.toString();
    const text = message.text;

    if (!text) {
      return 'Received message without text';
    }

    // Handle commands
    if (text.startsWith('/')) {
      // Extract command and parameters
      const parts = text.split(' ');
      const commandWithParams = parts[0].substring(1);
      const commandParts = commandWithParams.split('@'); // Handle commands with bot username
      const command = commandParts[0];
      const params = parts.slice(1);

      switch (command) {
        case 'start':
          let referralCode = null;

          // Check if there's a parameter that might be a referral code
          if (params.length > 0) {
            referralCode = params[0];

            // Process the referral code
            this.logger.log(
              `User ${userId} was referred by code: ${referralCode}`,
            );

            // If the user has a Telegram ID, we can process the referral
            if (userId) {
              // First, check if the user already exists as an operator
              const operatorId =
                await this.referralService.getOperatorIdByTelegramId(userId);

              // Then get the referring operator from the referral code
              const referrerId =
                await this.referralService.getUserIdFromReferralCode(
                  referralCode,
                );

              // If both exist and aren't the same user, we can process the referral later
              // when the user registers (we'll store the referral code in the URL)
              if (referrerId && operatorId && !referrerId.equals(operatorId)) {
                this.logger.log(
                  `User ${userId} (operator ${operatorId}) was referred by operator ${referrerId}`,
                );
                // The actual processing will happen when the user registers through the web app
              }
            }
          }

          // Send the regular start message with game link
          await this.sendTelegramMessage(chatId, 'Play Hashland!', {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'Open Game',
                    web_app: {
                      url:
                        this.hashlandUrl +
                        (referralCode ? `?ref=${referralCode}` : ''),
                    },
                  },
                ],
              ],
            },
          });
          return 'Processed /start command';

        case 'referral':
          if (!userId) {
            await this.sendTelegramMessage(
              chatId,
              'Could not generate referral link. Please try again later.',
            );
            return 'Failed to generate referral: missing user ID';
          }

          return await this.sendReferralLink(chatId, userId);

        case 'help':
          await this.sendTelegramMessage(
            chatId,
            'Available commands:\n/start - Start the bot\n/referral - Get your referral link\n/help - Show this help message',
          );
          return 'Processed /help command';

        default:
          await this.sendTelegramMessage(chatId, `Unknown command: ${command}`);
          return `Received unknown command: ${command}`;
      }
    }

    // Default response for non-command messages
    await this.sendTelegramMessage(
      chatId,
      'I received your message, but I only respond to commands.',
    );
    return 'Processed regular message';
  }

  /**
   * Send a referral link to a user based on their Telegram ID
   * @param chatId - The chat ID to send to
   * @param telegramId - The user's Telegram ID
   * @returns Status message
   */
  private async sendReferralLink(
    chatId: string | number,
    telegramId: string,
  ): Promise<string> {
    try {
      // Get the operator's ID from the Telegram ID
      const operatorId =
        await this.referralService.getOperatorIdByTelegramId(telegramId);

      if (!operatorId) {
        await this.sendTelegramMessage(
          chatId,
          'You need to play Hashland first to get a referral link!',
        );
        return 'Failed to generate referral: operator not found';
      }

      // Get the operator's referral stats
      const referralStatsResponse =
        await this.referralService.getReferralStats(operatorId);

      if (!referralStatsResponse.data) {
        await this.sendTelegramMessage(
          chatId,
          'Error generating referral link. Please try again later.',
        );
        return 'Failed to generate referral: could not get stats';
      }

      const { referralCode, totalReferrals, rewards } =
        referralStatsResponse.data;

      // Get the bot's username for the referral link
      const botUsername = await this.getBotUsername();

      if (!botUsername) {
        await this.sendTelegramMessage(
          chatId,
          'Error generating referral link. Please try again later.',
        );
        return 'Failed to generate referral link: could not get bot username';
      }

      // Create the referral link and additional statistics message
      const referralLink = `https://t.me/${botUsername}?start=${referralCode}`;

      let additionalStats = `\n\nYou have invited ${totalReferrals} friends so far!`;

      if (rewards.effCredits > 0 || rewards.hashBonus > 0) {
        additionalStats += `\nTotal rewards earned: ${rewards.effCredits} EFF credits, ${rewards.hashBonus} HASH bonus`;
      }

      // Send the message with the referral link
      await this.sendTelegramMessage(
        chatId,
        `Share your unique Hashland referral link with friends:${additionalStats}\n\n${referralLink}\n\nWhen they join through your link, you'll both receive special bonuses!`,
      );

      return 'Sent referral link';
    } catch (error) {
      this.logger.error(
        `Error sending referral link: ${error.message}`,
        error.stack,
      );
      await this.sendTelegramMessage(
        chatId,
        'Error generating referral link. Please try again later.',
      );
      return `Error sending referral link: ${error.message}`;
    }
  }

  /**
   * Check if a user is a member of a specific Telegram channel
   * @param dto - Contains userId and channelId to check
   * @returns Information about the user's membership status
   */
  async checkChannelMembership(
    dto: CheckChannelMembershipDto,
  ): Promise<ApiResponse<ChannelMembershipResponseDto>> {
    try {
      const { userId, channelId } = dto;

      // First check if this is a valid operator
      const operatorInfo = await this.isValidOperator(userId);
      if (!operatorInfo.exists) {
        throw new HttpException('User is not a registered operator', 404);
      }

      // Check if we have a recent membership record
      const lastValidTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const existingMembership = await this.channelMemberModel.findOne({
        operatorId: operatorInfo.operatorId,
        channelId,
        lastVerified: { $gte: lastValidTime },
      });

      // If we have a recent verification, use that
      if (existingMembership) {
        return new ApiResponse(
          200,
          'Channel membership checked successfully',
          new ChannelMembershipResponseDto({
            isMember: existingMembership.isMember,
            lastVerified: existingMembership.lastVerified,
            channelTitle: existingMembership.channelTitle,
          }),
        );
      }

      // Otherwise, check with Telegram API directly
      const isMember = await this.checkChannelMembershipWithAPI(
        userId,
        channelId,
      );

      // Get channel information
      const chatInfo = await this.getChatInfo(channelId);
      const channelTitle = chatInfo.title || `Chat ${channelId}`;
      const channelType = chatInfo.type || 'unknown';

      // Save the membership status
      await this.channelMemberModel.findOneAndUpdate(
        { operatorId: operatorInfo.operatorId, channelId },
        {
          $set: {
            operatorId: operatorInfo.operatorId,
            channelId,
            channelType,
            channelTitle,
            isMember,
            lastVerified: new Date(),
          },
        },
        { upsert: true },
      );

      return new ApiResponse(
        200,
        'Channel membership checked successfully',
        new ChannelMembershipResponseDto({
          isMember,
          lastVerified: new Date(),
          channelTitle,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Error checking channel membership: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        new ApiResponse(
          500,
          `Error checking channel membership: ${error.message}`,
        ),
      );
    }
  }

  /**
   * Check if a Telegram user ID is associated with a valid operator
   * @param userId - The Telegram user ID to check
   * @returns Whether the user exists as an operator and their operator ID
   */
  private async isValidOperator(
    userId: string,
  ): Promise<{ exists: boolean; operatorId?: Types.ObjectId }> {
    try {
      const operator = await this.findOperatorByTelegramId(userId);
      if (!operator) {
        return { exists: false };
      }
      return { exists: true, operatorId: operator._id };
    } catch (error) {
      this.logger.error(
        `Error checking operator: ${error.message}`,
        error.stack,
      );
      return { exists: false };
    }
  }

  /**
   * Find an operator by their Telegram ID
   * @param telegramId - The Telegram user ID
   * @returns The operator document or null if not found
   */
  private async findOperatorByTelegramId(
    telegramId: string,
  ): Promise<Operator | null> {
    try {
      // Use the OperatorService to find an operator by Telegram ID
      return await this.operatorService.findByTelegramId(telegramId);
    } catch (error) {
      this.logger.error(
        `Error finding operator: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Check if a user is a member of a channel using the Telegram API
   * @param userId - Telegram user ID
   * @param channelId - Telegram channel ID
   * @returns Whether the user is a member of the channel
   */
  private async checkChannelMembershipWithAPI(
    userId: string,
    channelId: string,
  ): Promise<boolean> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/getChatMember`, {
        params: {
          chat_id: channelId,
          user_id: userId,
        },
      });

      if (response.data.ok) {
        const status = response.data.result.status;
        // User is a member if they are a member, administrator, or creator
        return ['member', 'administrator', 'creator'].includes(status);
      }

      return false;
    } catch (error) {
      this.logger.error(
        `Error checking channel membership with API: ${error.message}`,
        error.stack,
      );
      // If API request fails, assume they're not a member
      return false;
    }
  }

  /**
   * Get information about a Telegram chat
   * @param chatId - The Telegram chat ID
   * @returns Information about the chat
   */
  private async getChatInfo(
    chatId: string,
  ): Promise<{ title: string; type: string }> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/getChat`, {
        params: {
          chat_id: chatId,
        },
      });

      if (response.data.ok) {
        const chat = response.data.result;
        return {
          title: chat.title || `Chat ${chatId}`,
          type: chat.type || 'unknown',
        };
      }

      return { title: `Chat ${chatId}`, type: 'unknown' };
    } catch (error) {
      this.logger.error(
        `Error getting chat info: ${error.message}`,
        error.stack,
      );
      return { title: `Chat ${chatId}`, type: 'unknown' };
    }
  }

  /**
   * Set up a webhook URL for the Telegram bot
   * @param url - The webhook URL
   * @param secretToken - Optional secret token for webhook verification
   * @returns Success message
   */
  async setWebhook(
    url: string,
    secretToken?: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const params: Record<string, any> = {
        url,
        allowed_updates: [
          'message',
          'chat_member',
          'callback_query',
          'chat_join_request',
        ],
      };

      if (secretToken) {
        params.secret_token = secretToken;
      }

      this.logger.debug(`${this.apiBaseUrl}/setWebhook`);

      const response = await axios.post(
        `${this.apiBaseUrl}/setWebhook`,
        params,
      );

      if (response.data.ok) {
        return {
          success: true,
          message: `Webhook set successfully to ${url}`,
        };
      } else {
        return {
          success: false,
          message: `Failed to set webhook: ${response.data.description}`,
        };
      }
    } catch (error) {
      this.logger.error(`Error setting webhook: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        new ApiResponse(500, `Error setting webhook: ${error.message}`),
      );
    }
  }

  /**
   * Delete the current webhook
   * @returns Success message
   */
  async deleteWebhook(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await axios.post(`${this.apiBaseUrl}/deleteWebhook`);

      if (response.data.ok) {
        return {
          success: true,
          message: 'Webhook deleted successfully',
        };
      } else {
        return {
          success: false,
          message: `Failed to delete webhook: ${response.data.description}`,
        };
      }
    } catch (error) {
      this.logger.error(
        `Error deleting webhook: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        new ApiResponse(500, `Error deleting webhook: ${error.message}`),
      );
    }
  }

  /**
   * Get information about the current webhook
   * @returns Webhook information
   */
  async getWebhookInfo(): Promise<any> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/getWebhookInfo`);
      return response.data.result;
    } catch (error) {
      this.logger.error(
        `Error getting webhook info: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        new ApiResponse(500, `Error getting webhook info: ${error.message}`),
      );
    }
  }

  /**
   * Send a message to a Telegram chat
   * @param chatId - The chat ID to send to
   * @param text - The message text
   * @param options - Additional options for the message
   * @returns The sent message
   */
  async sendTelegramMessage(
    chatId: string | number,
    text: string,
    options: Record<string, any> = {},
  ): Promise<any> {
    try {
      const params = {
        chat_id: chatId,
        text,
        ...options,
      };

      const response = await axios.post(
        `${this.apiBaseUrl}/sendMessage`,
        params,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Error sending Telegram message: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        new ApiResponse(
          500,
          `Error sending Telegram message: ${error.message}`,
        ),
      );
    }
  }

  /**
   * Get the bot's username
   * @returns The bot's username
   */
  private async getBotUsername(): Promise<string> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/getMe`);
      if (response.data.ok) {
        return response.data.result.username;
      }
      return '';
    } catch (error) {
      this.logger.error(
        `Error getting bot username: ${error.message}`,
        error.stack,
      );
      return '';
    }
  }
}
