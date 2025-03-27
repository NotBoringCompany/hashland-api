import { Controller, Post, Body, HttpCode, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WalletAuthService } from './wallet-auth.service';
import {
  WalletLoginDto,
  SignatureMessageResponse,
  SignatureMessageResponseData,
} from '../common/dto/wallet-auth.dto';
import { AuthenticatedResponse } from '../common/dto/auth.dto';
import {
  ProofChallengeResponseData,
  ProofChallengeResponse,
} from '../common/dto/wallet.dto';
import { OperatorWalletService } from 'src/operators/operator-wallet.service';

@ApiTags('Wallet Authentication')
@Controller('auth/wallet')
export class WalletAuthController {
  constructor(
    private readonly walletAuthService: WalletAuthService,
    private readonly operatorWalletService: OperatorWalletService,
  ) {}

  @ApiOperation({
    summary: 'Authenticate with wallet',
    description: 'Authenticates a user using their wallet signature',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully authenticated',
    type: AuthenticatedResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid wallet authentication data',
  })
  @ApiResponse({
    status: 401,
    description:
      'Unauthorized - Invalid signature or wallet not linked to any operator',
  })
  @Post('login')
  @HttpCode(200)
  async walletLogin(
    @Body() walletLoginDto: WalletLoginDto,
  ): Promise<AuthenticatedResponse> {
    return this.walletAuthService.walletLogin(walletLoginDto);
  }

  @ApiOperation({
    summary: 'Get EVM signature message',
    description:
      'Retrieves a message for EVM wallet to sign for authentication',
  })
  @ApiResponse({
    status: 200,
    description: 'Signature message generated',
    type: SignatureMessageResponse,
  })
  @Get('message')
  getEVMSignatureMessage(
    @Query('address') address: string,
  ): SignatureMessageResponse {
    const message =
      this.operatorWalletService.requestEVMSignatureMessage(address);
    const responseData: SignatureMessageResponseData = {
      message,
    };
    return new SignatureMessageResponse(responseData);
  }

  @ApiOperation({
    summary: 'Generate proof challenge',
    description: 'Generates a challenge message for wallet validation',
  })
  @ApiResponse({
    status: 200,
    description: 'Proof challenge generated',
    type: ProofChallengeResponse,
  })
  @Post('challenge')
  @HttpCode(200)
  generateProofChallenge(
    @Query('address') address: string,
  ): ProofChallengeResponse {
    const { message, nonce } =
      this.operatorWalletService.generateProofChallenge(address);

    const responseData: ProofChallengeResponseData = {
      message,
      nonce,
    };

    return new ProofChallengeResponse(responseData);
  }
}
