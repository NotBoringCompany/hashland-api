import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';
import { Operator } from '../operators/schemas/operator.schema';
import { TelegramAuthDto } from './telegram-auth.dto';

@Injectable()
export class TelegramAuthService {
  private readonly botToken: string;

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!this.botToken) {
      throw new Error(
        'TELEGRAM_BOT_TOKEN is not defined in environment variables',
      );
    }
  }

  generateToken(operator: Operator) {
    const payload = {
      sub: operator._id,
      username: operator.username,
      telegram_id: operator.tgProfile?.tgId,
    };
    return this.jwtService.sign(payload);
  }

  /**
   * Validates Telegram authentication data
   * @param authData - The authentication data from Telegram
   * @returns boolean indicating if the data is valid
   */
  validateTelegramAuth(authData: TelegramAuthDto): boolean {
    // Check if auth_date is not older than 24 hours
    const authDate = parseInt(authData.auth_date, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - authDate > 86400) {
      return false;
    }

    // Create data check string
    const { hash, ...data } = authData;
    const dataCheckString = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join('\n');

    // Create secret key
    const secretKey = createHash('sha256').update(this.botToken).digest();

    // Calculate hash
    const calculatedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Compare hashes
    return calculatedHash === hash;
  }

  /**
   * Authenticates a user with Telegram data
   * @param authData - The authentication data from Telegram
   * @returns The operator's ID or null if authentication fails
   */
  async authenticateWithTelegram(
    authData: TelegramAuthDto,
  ): Promise<string | null> {
    // Validate the authentication data
    if (!this.validateTelegramAuth(authData)) {
      return null;
    }

    // Try to update the operator if it exists.
    // This will update tgUsername if authData.username is provided.
    let operator = await this.operatorModel.findOneAndUpdate(
      { 'tgProfile.tgId': authData.id },
      authData.username
        ? { $set: { 'tgProfile.tgUsername': authData.username } }
        : {},
      { new: true },
    );

    if (operator) {
      return String(operator._id);
    }

    // If no operator was found, create a new one.
    // Generate a unique username based on the Telegram username or ID.
    const baseUsername = authData.username || `tg_${authData.id}`;
    let username = baseUsername;
    let counter = 1;

    // Check for uniqueness using exists() which is more efficient than a full findOne.
    while (await this.operatorModel.exists({ username })) {
      username = `${baseUsername}_${counter}`;
      counter++;
    }

    operator = await this.operatorModel.create({
      username,
      tgProfile: {
        tgId: authData.id,
        tgUsername: authData.username || `user_${authData.id}`,
      },
    });

    return String(operator._id);
  }
}
