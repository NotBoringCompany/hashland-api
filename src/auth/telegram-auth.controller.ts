import { Controller, Post, Body, UnauthorizedException, HttpCode } from '@nestjs/common';
import { TelegramAuthService } from './telegram-auth.service';
import { TelegramAuthDto } from './telegram-auth.dto';

@Controller('auth/telegram')
export class TelegramAuthController {
    constructor(private readonly telegramAuthService: TelegramAuthService) { }

    @Post('login')
    @HttpCode(200)
    async telegramLogin(@Body() authData: TelegramAuthDto) {
        const operator = await this.telegramAuthService.authenticateWithTelegram(authData);

        if (!operator) {
            throw new UnauthorizedException('Invalid Telegram authentication data');
        }

        // Return operator data
        return {
            success: true,
            operator: {
                id: operator._id,
                username: operator.username,
                telegramUsername: operator.tgProfile?.tgUsername,
                weightedAssetEquity: operator.weightedAssetEquity,
                maxEffAllowed: operator.maxEffAllowed,
                maxFuel: operator.maxFuel,
                currentFuel: operator.currentFuel,
            },
            // In a real application, you would generate and return a JWT token here
            // token: this.jwtService.sign({ sub: operator._id, username: operator.username })
        };
    }
}