import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { TelegramAuthService } from './telegram-auth.service';
import { TelegramAuthDto } from '../common/dto/telegram-auth.dto';
import { AuthenticatedResponse } from './dto/auth.dto';

@Controller('auth/telegram')
export class TelegramAuthController {
  constructor(private readonly telegramAuthService: TelegramAuthService) {}

  @Post('login')
  @HttpCode(200)
  async telegramLogin(
    @Body() authData: TelegramAuthDto,
  ): Promise<AuthenticatedResponse> {
    return this.telegramAuthService.telegramLogin(authData);
  }
}
