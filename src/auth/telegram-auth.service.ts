import {
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';
import { Operator } from '../operators/schemas/operator.schema';
import {
  TelegramAuthDto,
  TelegramAuthData,
  TelegramCreds,
} from '../common/dto/telegram-auth.dto';
import { ApiResponse } from 'src/common/dto/response.dto';
import { OperatorService } from 'src/operators/operator.service';
import { AuthenticatedResponse } from '../common/dto/auth.dto';
import { OperatorWalletService } from 'src/operators/operator-wallet.service';

/**
 * Service handling Telegram authentication and operator management
 */
@Injectable()
export class TelegramAuthService {
  private readonly botToken: string;

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    private operatorService: OperatorService,
    private operatorWalletService: OperatorWalletService,
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!this.botToken) {
      throw new Error(
        'TELEGRAM_BOT_TOKEN is not defined in environment variables',
      );
    }
  }

  /**
   * Generates a JWT token for an operator
   * @param operator - The operator to generate token for
   * @returns Signed JWT token string
   */
  generateToken(operator: Partial<Operator>): string {
    const payload = {
      operatorId: operator._id,
    };
    return this.jwtService.sign(payload);
  }

  /**
   * Handles Telegram login authentication
   * @param authData - Telegram authentication data
   * @returns AuthenticatedResponse with operator details and access token
   * @throws InternalServerErrorException on authentication failure
   */
  async telegramLogin(
    authData: TelegramAuthDto,
  ): Promise<AuthenticatedResponse> {
    try {
      const parsedAuthData = this.parseTelegramInitData(authData.initData);

      if (!this.validateTelegramAuth(parsedAuthData)) {
        throw new HttpException('Invalid Telegram authentication data', 401);
      }

      // Create a username if not available (some users don't have usernames)
      const username =
        parsedAuthData.user.username || `user_${parsedAuthData.user.id}`;

      const operator = await this.operatorService.findOrCreateOperator({
        id: parsedAuthData.user.id.toString(),
        username,
      });

      if (!operator) {
        throw new HttpException('Failed to create operator', 500);
      }

      // ✅ Update asset equity when the operator logs in
      await this.operatorWalletService.updateAssetEquityForOperator(
        operator._id,
      );

      const accessToken = this.generateToken({ _id: operator._id });

      return new AuthenticatedResponse({
        operator,
        accessToken,
      });
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(telegramLogin) Error authenticating with Telegram: ${err.message}`,
        ),
      );
    }
  }

  /**
   * Validates Telegram authentication data
   * @param authData - The authentication data from Telegram
   * @returns boolean indicating if the data is valid
   */
  validateTelegramAuth(authData: TelegramAuthData): boolean {
    // Check if auth_date is not older than 24 hours
    const authDate = parseInt(authData.auth_date, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - authDate > 86400) {
      return false;
    }

    // Create data check string by sorting and joining key-value pairs
    const { hash, ...data } = authData;
    const dataCheckString = Object.keys(data)
      .sort()
      .map((key) => `${key}=${data[key]}`)
      .join('\n');

    // Create secret key using SHA-256 hash of bot token
    const secretKey = createHash('sha256').update(this.botToken).digest();

    // Calculate HMAC hash of data string
    const calculatedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return calculatedHash === hash;
  }

  /**
   * Parses and validates Telegram initialization data
   * @param initData - Raw initialization data string from Telegram
   * @returns Parsed and validated TelegramAuthData
   * @throws Error if required fields are missing or data format is invalid
   */
  private parseTelegramInitData(initData: string): TelegramAuthData {
    const parsedData = new URLSearchParams(initData);
    const data: any = {};

    // Check if data has signature instead of hash
    const hasSignature = parsedData.has('signature');

    // Validate required fields exist
    const requiredFields = ['query_id', 'user', 'auth_date'];
    // Add hash or signature check
    if (!hasSignature && !parsedData.has('hash')) {
      throw new Error('Missing required field: hash or signature');
    }

    for (const field of requiredFields) {
      if (!parsedData.has(field)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    parsedData.forEach((value, key) => {
      data[key] = value;
    });

    try {
      // Handle escaped backslashes by replacing \\/ with /
      const cleanedUserData = data.user.replace(/\\\//g, '/');
      const userData = JSON.parse(cleanedUserData);

      // Validate required user fields
      const requiredUserFields = ['id', 'first_name'];
      // Username is not always present
      for (const field of requiredUserFields) {
        if (!userData[field]) {
          throw new Error(`Missing required user field: ${field}`);
        }
      }

      // If signature is present instead of hash, use it as hash
      if (hasSignature) {
        data.hash = data.signature;
        delete data.signature;
      }

      return {
        ...data,
        user: userData,
      };
    } catch {
      throw new Error('Invalid user data format');
    }
  }

  /**
   * Creates a test user without Telegram validation
   * @returns AuthenticatedResponse with test operator details and access token
   */
  async testLogin(): Promise<AuthenticatedResponse> {
    try {
      const testUser: TelegramCreds = {
        id: 12345,
        first_name: 'Test',
        last_name: 'User',
        username: 'test_user',
        language_code: 'en',
        allows_write_to_pm: true,
      };

      let operator = (await this.operatorModel.findOne({
        'tgProfile.tgId': testUser.id,
      })) as Operator;

      if (!operator) {
        operator = await this.operatorService.findOrCreateOperator({
          id: testUser.id.toString(),
          username: testUser.username,
        });
      }

      const accessToken = this.generateToken({ _id: operator._id });

      return new AuthenticatedResponse({
        operator,
        accessToken,
      });
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `(testLogin) Error creating test user: ${err.message}`,
        ),
      );
    }
  }
}
