import {
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
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
import { MixpanelService } from 'src/mixpanel/mixpanel.service';
import { EVENT_CONSTANTS } from 'src/common/constants/mixpanel.constants';

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
    private readonly mixpanelService: MixpanelService,
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

      if (!this.validateTelegramAuth(authData.initData)) {
        throw new HttpException('Invalid Telegram authentication data', 401);
      }

      const { operator, type } =
        await this.operatorService.findOrCreateOperator(
          {
            id: parsedAuthData.user.id.toString(),
            username: parsedAuthData.user.username,
          },
          {},
          authData.referralCode,
        );

      if (!operator) {
        throw new HttpException('Failed to create operator', 500);
      }

      // ✅ Update asset equity when the operator logs in
      await this.operatorWalletService.updateAssetEquityForOperator(
        operator._id,
      );

      // ✅ Update cumulativeEff for the operator
      await this.operatorService.updateCumulativeEffForSingleOperator(
        operator._id,
      );

      const accessToken = this.generateToken({ _id: operator._id });

      this.mixpanelService.track(
        type === 'login'
          ? EVENT_CONSTANTS.AUTH_LOGIN
          : EVENT_CONSTANTS.AUTH_REGISTER,
        {
          distinct_id: operator._id,
          operator,
          service: 'Telegram',
        },
      );

      return new AuthenticatedResponse({
        operator,
        accessToken,
      });
    } catch (err: any) {
      throw new InternalServerErrorException(
        new ApiResponse<TelegramAuthDto>(
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
  validateTelegramAuth(authData: string): boolean {
    const initData = new URLSearchParams(authData);
    initData.sort();
    // Step 1: Destructure hash & auth_date data
    const auth_date = initData.get('auth_date');
    const hash = initData.get('hash');
    initData.delete('hash');

    // Step 2: Check auth_date session
    if (!auth_date) return false;
    const authDate = parseInt(auth_date, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - authDate > 86400) {
      return false;
    }

    const dataToCheck = [...initData.entries()]
      .map(([key, value]) => key + '=' + value)
      .join('\n');

    // Step 3 & 4: Create HMAC-SHA256 using key 'WebAppData' and apply it to bot token
    const secretKey = createHmac('sha256', 'WebAppData')
      .update(this.botToken)
      .digest();

    // Step 4 & 5: Create HMAC-SHA256 using the result of the previous step as a key
    // Apply it to the pairs array joined with linebreak
    const calculatedHash = createHmac('sha256', secretKey)
      .update(dataToCheck)
      .digest('hex');

    // Step 6: Compare the hash values
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

    // Required fields for basic functionality
    const requiredFields = ['auth_date', 'hash'];
    for (const field of requiredFields) {
      if (!parsedData.has(field)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Parse all fields from URL params
    parsedData.forEach((value, key) => {
      // Convert JSON strings to objects
      if (key === 'user' || key === 'receiver' || key === 'chat') {
        try {
          data[key] = JSON.parse(value);
        } catch {
          throw new Error(`Invalid JSON format for field: ${key}`);
        }
      } else {
        data[key] = value;
      }
    });

    // Validate user data if present
    if (data.user) {
      const requiredUserFields = ['id'];
      for (const field of requiredUserFields) {
        if (!data.user[field]) {
          throw new Error(`Missing required user field: ${field}`);
        }
      }
    }

    return data as TelegramAuthData;
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

      let operatorData: {
        operator: Operator;
        type: 'login' | 'register';
      } | null = {
        operator: (await this.operatorModel.findOne({
          'tgProfile.tgId': testUser.id,
        })) as Operator,
        type: 'login',
      };

      if (!operatorData.operator) {
        operatorData = await this.operatorService.findOrCreateOperator({
          id: testUser.id.toString(),
          username: testUser.username,
        });
      }

      console.log(operatorData);

      const accessToken = this.generateToken({
        _id: operatorData.operator._id,
      });

      return new AuthenticatedResponse({
        operator: operatorData.operator,
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
