import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TelegramService } from './telegram.service';
import {
  ApiOperation,
  ApiResponse as SwaggerResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  ChannelMembershipResponseDto,
  CheckChannelMembershipDto,
  SetWebhookDto,
  TelegramWebhookDto,
} from './dto/telegram-webhook.dto';
import { JwtAuthGuard } from 'src/auth/jwt/jwt-auth.guard';
import { AdminProtected } from 'src/auth/admin';

@ApiTags('Telegram')
@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  /**
   * Webhook endpoint for receiving updates from the Telegram Bot API
   */
  @ApiOperation({
    summary: 'Receive Telegram webhook updates',
    description: 'Receives and processes webhook updates from Telegram Bot API',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Update received and processed',
  })
  @SwaggerResponse({
    status: 500,
    description: 'Server error while processing webhook',
  })
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Body() webhookData: TelegramWebhookDto,
  ): Promise<{ success: boolean; message: string }> {
    return this.telegramService.processWebhook(webhookData);
  }

  /**
   * Check if a user is a member of a specified Telegram channel
   */
  @ApiOperation({
    summary: 'Check channel membership',
    description: 'Verify if a user is a member of a specified Telegram channel',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Successfully checked membership',
    type: ChannelMembershipResponseDto,
  })
  @SwaggerResponse({
    status: 404,
    description: 'User not found or not a registered operator',
  })
  @SwaggerResponse({
    status: 500,
    description: 'Server error while checking membership',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('check-channel-membership')
  async checkChannelMembership(
    @Body() dto: CheckChannelMembershipDto,
  ): Promise<ChannelMembershipResponseDto> {
    return this.telegramService.checkChannelMembership(dto);
  }

  /**
   * Set a webhook URL for the Telegram bot
   */
  @ApiOperation({
    summary: 'Set Telegram webhook',
    description: 'Configure the webhook URL for the Telegram bot',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Webhook set successfully',
  })
  @SwaggerResponse({
    status: 500,
    description: 'Failed to set webhook',
  })
  @AdminProtected()
  @Post('set-webhook')
  async setWebhook(
    @Body() dto: SetWebhookDto,
  ): Promise<{ success: boolean; message: string }> {
    return this.telegramService.setWebhook(dto.url, dto.secretToken);
  }

  /**
   * Delete the current webhook
   */
  @ApiOperation({
    summary: 'Delete Telegram webhook',
    description: 'Remove the currently configured webhook',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Webhook deleted successfully',
  })
  @SwaggerResponse({
    status: 500,
    description: 'Failed to delete webhook',
  })
  @AdminProtected()
  @Delete('webhook')
  async deleteWebhook(): Promise<{ success: boolean; message: string }> {
    return this.telegramService.deleteWebhook();
  }

  /**
   * Get information about the current webhook
   */
  @ApiOperation({
    summary: 'Get webhook info',
    description: 'Retrieve information about the currently configured webhook',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Webhook information retrieved successfully',
  })
  @SwaggerResponse({
    status: 500,
    description: 'Failed to get webhook information',
  })
  @AdminProtected()
  @Get('webhook-info')
  async getWebhookInfo(): Promise<any> {
    return this.telegramService.getWebhookInfo();
  }

  /**
   * Send a message to a specified chat
   */
  @ApiOperation({
    summary: 'Send Telegram message',
    description: 'Send a message to a specified Telegram chat',
  })
  @SwaggerResponse({
    status: 200,
    description: 'Message sent successfully',
  })
  @SwaggerResponse({
    status: 500,
    description: 'Failed to send message',
  })
  @AdminProtected()
  @Post('send-message')
  async sendMessage(
    @Query('chat_id') chatId: string,
    @Query('text') text: string,
  ): Promise<any> {
    return this.telegramService.sendTelegramMessage(chatId, text);
  }
}
