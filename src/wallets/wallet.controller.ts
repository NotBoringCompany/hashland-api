import {
  Controller,
  Post,
  Body,
  Param,
  Delete,
  Get,
  UseGuards,
  Request,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { WalletService } from './services/wallet.services';
import { WalletSignatureValidator } from '../wallets/utils/wallet-signature-validator';
import { ApiResponse } from '../common/dto/response.dto';
import {
  WalletConnectionRequest,
  WalletConnectionResponse,
} from './interfaces/wallet.interface';

@Controller('wallets')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly walletSignatureValidator: WalletSignatureValidator,
  ) {}

  /**
   * Generate a challenge message for wallet signature
   */
  @UseGuards(JwtAuthGuard)
  @Post('generate_signature_message')
  async generateChallenge(@Body() body: { address: string; type: string }) {
    const { address, type } = body;
    return {
      signatureMessage: this.walletSignatureValidator.generateChallengeMessage(
        address,
        type,
        this.walletSignatureValidator.generateNonce(),
      ),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('connect')
  async connectWallet(
    @Body() connectionRequest: WalletConnectionRequest,
    @Request() req,
  ): Promise<ApiResponse<WalletConnectionResponse>> {
    // Ensure the operator ID from the token matches the requested operator ID
    if (req.user.operatorId !== connectionRequest.operatorId) {
      throw new BadRequestException('Operator ID mismatch');
    }

    return this.walletService.connectWallet(connectionRequest);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':walletId')
  async disconnectWallet(
    @Param('walletId') walletId: string,
    @Request() req,
  ): Promise<ApiResponse<boolean>> {
    const operatorId = req.user.operatorId;
    return this.walletService.disconnectWallet(walletId, operatorId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':walletId/validate')
  async validateWallet(
    @Param('walletId') walletId: string,
    @Body() validationData: Record<string, any>,
    @Request() req,
  ): Promise<ApiResponse<boolean>> {
    const operatorId = req.user.operatorId;
    validationData.operatorId = operatorId;
    return this.walletService.validateWallet(walletId, validationData);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getWallets(
    @Request() req,
  ): Promise<ApiResponse<WalletConnectionResponse[]>> {
    const operatorId = req.user.operatorId;
    return this.walletService.getWalletsForOperator(operatorId);
  }
  @UseGuards(JwtAuthGuard)
  @Get(':walletId')
  async getWallet(
    @Param('walletId') walletId: string,
    @Request() req,
  ): Promise<ApiResponse<WalletConnectionResponse>> {
    const operatorId = req.user.operatorId;
    const wallet = await this.walletService.getWallet(walletId, operatorId);

    if (!wallet) {
      throw new NotFoundException(`Wallet with ID ${walletId} not found`);
    }

    return new ApiResponse<WalletConnectionResponse>(
      200,
      'Wallet retrieved successfully',
      { wallet },
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':walletId/events')
  async getWalletEvents(
    @Param('walletId') walletId: string,
    @Request() req,
  ): Promise<ApiResponse<any>> {
    const operatorId = req.user.operatorId;
    return this.walletService.getWalletEvents(walletId, operatorId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':walletId/balance')
  async getWalletBalance(
    @Param('walletId') walletId: string,
    @Request() req,
  ): Promise<ApiResponse<any>> {
    const operatorId = req.user.operatorId;
    return this.walletService.getWalletBalance(walletId, operatorId);
  }
}
