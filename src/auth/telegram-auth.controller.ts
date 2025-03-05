import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import { TelegramAuthService } from './telegram-auth.service';
import { TelegramAuthDto } from './telegram-auth.dto';
import { STATUS_CODES } from 'http';

@Controller('auth/telegram')
export class TelegramAuthController {
  constructor(private readonly telegramAuthService: TelegramAuthService) {}

  @Post('login')
  @HttpCode(200)
  async telegramLogin(@Body() authData: TelegramAuthDto) {
    const operator =
      await this.telegramAuthService.authenticateWithTelegram(authData);

    if (!operator) {
      throw new UnauthorizedException('Invalid Telegram authentication data');
    }

    // Generate JWT token
    const accessToken = this.telegramAuthService.generateToken(operator);

    // Return operator data
    return {
      statusCode: STATUS_CODES.OK,
      data: {
        operator: {
          id: operator._id,
          username: operator.username,
          telegramUsername: operator.tgProfile?.tgUsername,
          weightedAssetEquity: operator.weightedAssetEquity,
          maxEffAllowed: operator.maxEffAllowed,
          maxFuel: operator.maxFuel,
          currentFuel: operator.currentFuel,
        },
        accessToken,
      },
      message: 'Login successful',
    };
    // In a real application, you would generate and return a JWT token here
    // token: this.jwtService.sign({ sub: operator._id, username: operator.username })
  }
}
