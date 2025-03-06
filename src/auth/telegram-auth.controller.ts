import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { TelegramAuthService } from './telegram-auth.service';
import { TelegramAuthDto } from '../common/dto/telegram-auth.dto';
import { AuthenticatedResponse } from './dto/auth.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Telegram Authentication')
@Controller('auth/telegram')
export class TelegramAuthController {
  constructor(private readonly telegramAuthService: TelegramAuthService) {}

  @ApiOperation({
    summary: 'Authenticate with Telegram',
    description: 'Authenticates a user using Telegram login widget data',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully authenticated',
    type: AuthenticatedResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid Telegram authentication data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired Telegram data',
  })
  @Post('login')
  @HttpCode(200)
  async telegramLogin(
    @Body() authData: TelegramAuthDto,
  ): Promise<AuthenticatedResponse> {
    return this.telegramAuthService.telegramLogin(authData);
  }
}
