import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Referral } from './schemas/referral.schema';
import { Operator } from 'src/operators/schemas/operator.schema';
import {
  ReferralCodeResponseDto,
  ReferralStatsResponseDto,
} from './dto/referral.dto';
import { ApiResponse } from 'src/common/dto/response.dto';
import { GAME_CONSTANTS } from 'src/common/constants/game.constants';
import { ReferredUserDto } from './dto/referred-users.dto';
import { PaginatedResponse } from 'src/common/dto/paginated-response.dto';

/**
 * Service for managing referrals
 */
@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    @InjectModel(Referral.name) private referralModel: Model<Referral>,
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
  ) {}

  /**
   * Generates or retrieves a unique referral code for an operator
   * @param operatorId The operator's ID
   * @returns The referral code
   */
  async getOperatorReferralCode(
    operatorId: Types.ObjectId,
  ): Promise<ReferralCodeResponseDto> {
    try {
      // Check if operator already has a referral code
      const operator = await this.operatorModel
        .findOne({ _id: operatorId }, { 'referralData.referralCode': 1 })
        .lean();

      if (!operator) {
        throw new NotFoundException(
          '(getOperatorReferralCode) Operator not found',
        );
      }

      // If operator already has a referral code, return it
      if (operator.referralData?.referralCode) {
        return new ReferralCodeResponseDto({
          referralCode: operator.referralData.referralCode,
          isNew: false,
        });
      }

      // Generate a new referral code
      const referralCode = this.generateReferralCode(operatorId.toString());

      // Save the referral code to the operator
      await this.operatorModel.updateOne(
        { _id: operatorId },
        {
          $set: { 'referralData.referralCode': referralCode },
        },
      );

      return new ReferralCodeResponseDto({
        referralCode,
        isNew: true,
      });
    } catch (error) {
      this.logger.error(
        `(getOperatorReferralCode) Error: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        return {
          referralCode: '',
          isNew: false,
        } as ReferralCodeResponseDto;
      }

      throw new InternalServerErrorException(
        `Error generating referral code: ${error.message}`,
      );
    }
  }

  /**
   * Generate a unique referral code for a user
   * @param userId - The operator ID to encode
   * @returns A unique referral code
   */
  private generateReferralCode(userId: string): string {
    // Simple encoding to generate a unique code based on user ID and timestamp
    const timestamp = Date.now().toString().slice(-6);
    const buffer = Buffer.from(userId + timestamp);
    return buffer
      .toString('base64')
      .replace(/[/+=]/g, '')
      .substring(0, GAME_CONSTANTS.REFERRAL.CODE_LENGTH)
      .toUpperCase();
  }

  /**
   * Process a referral when a new user signs up using a referral code
   * @param referralCode The referral code used
   * @param newOperatorId The ID of the newly registered operator
   * @returns Success status and message
   */
  async processReferral(
    referralCode: string,
    newOperatorId: Types.ObjectId,
  ): Promise<ApiResponse<{ referrerId?: Types.ObjectId }>> {
    try {
      // Find the referring operator
      const referrer = await this.operatorModel.findOne(
        { 'referralData.referralCode': referralCode },
        { _id: 1 },
      );

      if (!referrer) {
        throw new NotFoundException('Invalid referral code');
      }

      const referrerId = referrer._id;

      // Make sure the new operator isn't already referred and isn't referring themselves
      if (newOperatorId.equals(referrerId)) {
        throw new BadRequestException('Cannot refer yourself');
      }

      const newOperator = await this.operatorModel.findById(newOperatorId, {
        'referralData.referredBy': 1,
      });

      if (!newOperator) {
        throw new NotFoundException('New operator not found');
      }

      if (newOperator.referralData?.referredBy) {
        throw new BadRequestException('Operator already has a referrer');
      }

      // Check if a referral record already exists
      const existingReferral = await this.referralModel.findOne({
        referrerId,
        referredId: newOperatorId,
      });

      if (existingReferral) {
        throw new BadRequestException('Referral already exists');
      }

      // Create a new referral record
      await this.referralModel.create({
        referrerId,
        referredId: newOperatorId,
        referralCode,
        rewardsProcessed: false,
      });

      // Update the referrer's stats (increment total referrals)
      await this.operatorModel.updateOne(
        { _id: referrerId },
        { $inc: { 'referralData.totalReferrals': 1 } },
      );

      // Update the new operator with the referrer ID
      await this.operatorModel.updateOne(
        { _id: newOperatorId },
        { $set: { 'referralData.referredBy': referrerId } },
      );

      // Apply referral rewards if the operator has enough asset equity
      if (
        newOperator.assetEquity >=
        GAME_CONSTANTS.REFERRAL.REFERRAL_REWARDS_THRESHOLD
      ) {
        await this.applyReferralRewards(referrerId, newOperatorId);
      }

      return new ApiResponse(200, 'Referral processed successfully', {
        referrerId,
      });
    } catch (error) {
      this.logger.error(
        `(processReferral) Error: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        return new ApiResponse(404, error.message, null);
      }

      if (error instanceof BadRequestException) {
        return new ApiResponse(400, error.message, null);
      }

      return new ApiResponse(
        500,
        `Error processing referral: ${error.message}`,
        null,
      );
    }
  }

  /**
   * Apply rewards to both referrer and referred user
   * @param referrerId ID of the referring operator
   * @param referredId ID of the referred operator
   */
  async applyReferralRewards(
    referrerId: Types.ObjectId,
    referredId: Types.ObjectId,
  ): Promise<void> {
    try {
      // Get the referral record
      const referral = await this.referralModel.findOne({
        referrerId,
        referredId,
      });

      if (!referral || referral.rewardsProcessed) {
        return; // Skip if already processed or not found
      }

      // Get rewards from constants
      const referrerRewards = {
        effCredits: GAME_CONSTANTS.REFERRAL.REFERRER_REWARDS.EFF_CREDITS,
        hashBonus: GAME_CONSTANTS.REFERRAL.REFERRER_REWARDS.HASH_BONUS,
      };

      const referredRewards = {
        effCredits: GAME_CONSTANTS.REFERRAL.REFERRED_REWARDS.EFF_CREDITS,
        hashBonus: GAME_CONSTANTS.REFERRAL.REFERRED_REWARDS.HASH_BONUS,
      };

      // Apply referrer rewards
      await this.operatorModel.updateOne(
        { _id: referrerId },
        {
          $inc: {
            'referralData.referralRewards.effCredits':
              referrerRewards.effCredits,
            'referralData.referralRewards.hashBonus': referrerRewards.hashBonus,
            effCredits: referrerRewards.effCredits,
          },
        },
      );

      // Apply referred user rewards
      await this.operatorModel.updateOne(
        { _id: referredId },
        {
          $inc: {
            effCredits: referredRewards.effCredits,
          },
        },
      );

      // Update referral rewards in the referral record
      await this.referralModel.updateOne(
        { _id: referral._id },
        {
          $set: {
            referrerRewards,
            referredRewards,
            rewardsProcessed: true,
          },
        },
      );

      this.logger.log(
        `Applied referral rewards: Referrer ${referrerId} (+${referrerRewards.effCredits} EFF), ` +
          `Referred ${referredId} (+${referredRewards.effCredits} EFF)`,
      );
    } catch (error) {
      this.logger.error(
        `(applyReferralRewards) Error: ${error.message}`,
        error.stack,
      );
      // Don't throw - we don't want to break the referral process if rewards fail
    }
  }

  /**
   * Get user ID from a referral code by finding the operator with that code
   * @param referralCode The referral code to look up
   * @returns The operator ID that owns the referral code, or null if not found
   */
  async getUserIdFromReferralCode(
    referralCode: string,
  ): Promise<Types.ObjectId | null> {
    try {
      const operator = await this.operatorModel.findOne(
        { 'referralData.referralCode': referralCode },
        { _id: 1 },
      );

      return operator ? operator._id : null;
    } catch (error) {
      this.logger.error(
        `(getUserIdFromReferralCode) Error: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Get operator ID by Telegram ID
   * @param telegramId Telegram user ID
   * @returns Operator ID or null if not found
   */
  async getOperatorIdByTelegramId(
    telegramId: string,
  ): Promise<Types.ObjectId | null> {
    try {
      const operator = await this.operatorModel.findOne(
        { 'tgProfile.tgId': telegramId },
        { _id: 1 },
      );
      return operator ? operator._id : null;
    } catch (error) {
      this.logger.error(
        `(getOperatorIdByTelegramId) Error: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Get referral statistics for an operator
   * @param operatorId Operator ID
   * @returns Referral statistics
   */
  async getReferralStats(
    operatorId: Types.ObjectId,
  ): Promise<ApiResponse<ReferralStatsResponseDto>> {
    try {
      const operator = await this.operatorModel
        .findById(operatorId, {
          'referralData.referralCode': 1,
          'referralData.totalReferrals': 1,
          'referralData.referralRewards': 1,
        })
        .lean();

      if (!operator) {
        throw new NotFoundException('Operator not found');
      }

      // If the operator doesn't have a referral code yet, generate one
      if (!operator.referralData?.referralCode) {
        const referralCodeResponse =
          await this.getOperatorReferralCode(operatorId);

        return new ApiResponse(
          200,
          'Referral stats retrieved successfully',
          new ReferralStatsResponseDto({
            referralCode: referralCodeResponse.referralCode,
            totalReferrals: 0,
            rewards: { effCredits: 0, hashBonus: 0 },
          }),
        );
      }

      // Get additional stats from the referral collection
      const referralsCount = await this.referralModel.countDocuments({
        referrerId: operatorId,
      });

      return new ApiResponse(
        200,
        'Referral stats retrieved successfully',
        new ReferralStatsResponseDto({
          referralCode: operator.referralData.referralCode,
          totalReferrals: referralsCount,
          rewards: {
            effCredits: operator.referralData.referralRewards?.effCredits || 0,
            hashBonus: operator.referralData.referralRewards?.hashBonus || 0,
          },
        }),
      );
    } catch (error) {
      this.logger.error(
        `(getReferralStats) Error: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        return new ApiResponse(404, error.message, null);
      }

      return new ApiResponse(
        500,
        `Error retrieving referral stats: ${error.message}`,
        null,
      );
    }
  }

  /**
   * Get a list of users referred by a specific operator with pagination
   * @param operatorId Operator ID of the referrer
   * @param page Page number (starts from 1)
   * @param limit Maximum number of items per page
   * @param projection Optional fields to include in response
   * @returns Paginated list of referred users with their details
   */
  async getReferredUsers(
    operatorId: Types.ObjectId,
    page: number = 1,
    limit: number = 20,
    projection?: string | Record<string, 1 | 0>,
  ): Promise<PaginatedResponse<ReferredUserDto>> {
    try {
      // Validate pagination parameters
      if (page < 1) {
        throw new BadRequestException(`Invalid page number: ${page}`);
      }

      if (limit < 1 || limit > 100) {
        throw new BadRequestException(`Invalid limit: ${limit}`);
      }

      // Check if operator exists
      const operator = await this.operatorModel.findById(operatorId);

      if (!operator) {
        throw new NotFoundException('Operator not found');
      }

      // Convert string projection to object if provided
      let projectionObj: Record<string, 1> | undefined;
      if (typeof projection === 'string') {
        projectionObj = projection
          .split(',')
          .reduce((acc, field) => ({ ...acc, [field.trim()]: 1 }), {});
      } else {
        projectionObj = projection as Record<string, 1> | undefined;
      }

      // Count total documents first for pagination
      const totalCount = await this.referralModel.countDocuments({
        referrerId: operatorId,
      });

      if (totalCount === 0) {
        return new PaginatedResponse(200, 'No referred users found', {
          items: [],
          page,
          limit,
          total: 0,
        });
      }

      // Find all referrals where this operator is the referrer with pagination
      const referrals = await this.referralModel
        .find({ referrerId: operatorId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      // Get referred user details
      const referredUserIds = referrals.map((referral) => referral.referredId);

      // Verify that the referred users exist
      await this.operatorModel.find({ _id: { $in: referredUserIds } });

      // Map referrals to referredUserDto objects
      const referredUsers = referrals.map((referral) => {
        // If we have specific fields to include, apply them here
        if (projectionObj) {
          const userData: any = {};

          // Always include userId as a minimum
          userData.userId = referral.referredId;

          if (projectionObj.username || !Object.keys(projectionObj).length) {
            userData.username = `User-${referral.referredId.toString().substring(0, 8)}`;
          }

          if (
            projectionObj.referredDate ||
            !Object.keys(projectionObj).length
          ) {
            userData.referredDate = referral.createdAt;
          }

          if (
            projectionObj.rewardsProcessed ||
            !Object.keys(projectionObj).length
          ) {
            userData.rewardsProcessed = referral.rewardsProcessed;
          }

          return new ReferredUserDto(userData);
        }

        return new ReferredUserDto({
          userId: referral.referredId,
          username: `User-${referral.referredId.toString().substring(0, 8)}`,
          referredDate: referral.createdAt,
          rewardsProcessed: referral.rewardsProcessed,
        });
      });

      return new PaginatedResponse(
        200,
        'Referred users retrieved successfully',
        {
          items: referredUsers,
          page,
          limit,
          total: totalCount,
        },
      );
    } catch (error) {
      this.logger.error(
        `(getReferredUsers) Error: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        return new PaginatedResponse(404, error.message, null);
      }

      if (error instanceof BadRequestException) {
        return new PaginatedResponse(400, error.message, null);
      }

      return new PaginatedResponse(
        500,
        `Error retrieving referred users: ${error.message}`,
        null,
      );
    }
  }
}
