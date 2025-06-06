import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Types } from 'mongoose';
import { JwtAuthGuard } from 'src/auth/jwt/jwt-auth.guard';
import {
  ConnectWalletDto,
  ConnectedWalletResponse,
  ConnectedWalletResponseData,
  GenerateProofChallengeDto,
  GenerateTonProofPayloadDto,
  ProofChallengeResponse,
  ProofChallengeResponseData,
  TonApiStatusResponse,
  TonProofPayloadResponse,
  ValidateSignatureDto,
  VerifyTonProofDto,
  WalletValidationResponse,
  WalletValidationResponseData,
} from '../common/dto/wallet.dto';
import { ApiResponse as ApiResponseDto } from 'src/common/dto/response.dto';
import { OperatorWalletService } from './operator-wallet.service';

@ApiTags('Operator Wallets')
@Controller('operators/wallets')
export class OperatorWalletController {
  constructor(private readonly operatorWalletService: OperatorWalletService) {}

  @ApiOperation({
    summary: 'Request an EVM wallet signature message',
    description: 'Requests a message for EVM wallet signature verification',
  })
  @ApiResponse({
    status: 200,
    description: 'EVM signature message requested',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request - Missing or invalid parameters',
  })
  @Get('request-evm-signature-message')
  requestEVMSignatureMessage(@Query('address') address: string): string {
    return this.operatorWalletService.requestEVMSignatureMessage(address);
  }

  @ApiOperation({
    summary: 'Generate TON proof payload',
    description: 'Generates a payload token for TON wallet verification',
  })
  @ApiResponse({
    status: 200,
    description: 'TON proof payload generated',
    type: TonProofPayloadResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request - Missing or invalid parameters',
  })
  @Post('generate-ton-proof-payload')
  @HttpCode(200)
  async generateTonProofPayload(
    @Body() generateTonProofPayloadDto: GenerateTonProofPayloadDto,
  ): Promise<TonProofPayloadResponse> {
    const payload = this.operatorWalletService.generateTonProofPayload(
      generateTonProofPayloadDto.context,
    );

    return new TonProofPayloadResponse({ payload });
  }

  @ApiOperation({
    summary: 'Connect a TON wallet using TON proof',
    description:
      'Connects a TON wallet to the authenticated operator using TON proof verification',
  })
  @ApiResponse({
    status: 200,
    description: 'TON wallet connected successfully',
    type: ConnectedWalletResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid token or TON proof',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('connect-ton')
  @HttpCode(200)
  async connectTonWallet(
    @Request() req,
    @Body() verifyTonProofDto: VerifyTonProofDto,
  ): Promise<ConnectedWalletResponse> {
    const operatorId = new Types.ObjectId(req.user.operatorId);

    // Create a ConnectWalletDto with TON proof data
    const connectWalletDto = new ConnectWalletDto();
    connectWalletDto.address = verifyTonProofDto.address;
    connectWalletDto.chain = 'TON';
    connectWalletDto.tonProof = {
      tonAddress: verifyTonProofDto.address,
      public_key: verifyTonProofDto.public_key,
      proof: verifyTonProofDto.proof,
    };

    const wallet = await this.operatorWalletService.connectWallet(
      operatorId,
      connectWalletDto,
    );

    const responseData: ConnectedWalletResponseData = {
      _id: wallet._id,
    };

    return new ConnectedWalletResponse(responseData);
  }

  @ApiOperation({
    summary: 'Connect a wallet to an operator',
    description: 'Connects a wallet to the authenticated operator',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet connected successfully',
    type: ConnectedWalletResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid token or wallet signature',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('connect')
  @HttpCode(200)
  async connectWallet(
    @Request() req,
    @Body() connectWalletDto: ConnectWalletDto,
  ): Promise<ConnectedWalletResponse> {
    const operatorId = new Types.ObjectId(req.user.operatorId);
    const wallet = await this.operatorWalletService.connectWallet(
      operatorId,
      connectWalletDto,
    );

    const responseData: ConnectedWalletResponseData = {
      _id: wallet._id,
    };

    return new ConnectedWalletResponse(responseData);
  }

  @ApiOperation({
    summary: 'Get all wallets for an operator',
    description: 'Returns all wallets connected to the authenticated operator',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallets retrieved successfully',
    type: [ConnectedWalletResponseData],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid token',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  async getOperatorWallets(
    @Request() req,
  ): Promise<ApiResponseDto<ConnectedWalletResponseData[]>> {
    const operatorId = new Types.ObjectId(req.user.operatorId);
    const wallets =
      await this.operatorWalletService.getOperatorWallets(operatorId);

    const responseData = wallets.map((wallet) => ({
      _id: wallet._id,
      operatorId: wallet.operatorId,
      address: wallet.address,
      chain: wallet.chain,
    }));

    return new ApiResponseDto(
      200,
      'Wallets retrieved successfully',
      responseData,
    );
  }

  @ApiOperation({
    summary: 'Disconnect a wallet from an operator',
    description: 'Disconnects a wallet from the authenticated operator',
  })
  @ApiParam({
    name: 'walletId',
    description: 'The ID of the wallet to disconnect',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet disconnected successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid token',
  })
  @ApiResponse({
    status: 404,
    description: 'Wallet not found or not owned by operator',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':walletId')
  async disconnectWallet(
    @Request() req,
    @Param('walletId') walletId: string,
  ): Promise<ApiResponseDto<null>> {
    const operatorId = new Types.ObjectId(req.user.operatorId);
    await this.operatorWalletService.disconnectWallet(
      operatorId,
      new Types.ObjectId(walletId),
    );

    return new ApiResponseDto(200, 'Wallet disconnected successfully', null);
  }

  @ApiOperation({
    summary: 'Generate a proof challenge',
    description: 'Generates a challenge message for wallet validation',
  })
  @ApiResponse({
    status: 200,
    description: 'Proof challenge generated',
    type: ProofChallengeResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request - Missing or invalid parameters',
  })
  @Post('generate-proof')
  @HttpCode(200)
  async generateProofChallenge(
    @Body() generateProofChallengeDto: GenerateProofChallengeDto,
  ): Promise<ProofChallengeResponse> {
    const { address } = generateProofChallengeDto;
    const { message, nonce } =
      this.operatorWalletService.generateProofChallenge(address);

    const responseData: ProofChallengeResponseData = {
      message,
      nonce,
    };

    return new ProofChallengeResponse(responseData);
  }

  @ApiOperation({
    summary: 'Validate a wallet signature',
    description: 'Validates a wallet signature against a message',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet validation completed',
    type: WalletValidationResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request - Missing or invalid parameters',
  })
  @Post('validate-signature')
  @HttpCode(200)
  async validateSignature(
    @Body() validateSignatureDto: ValidateSignatureDto,
  ): Promise<WalletValidationResponse> {
    const { signature, message, address } = validateSignatureDto;
    const isValid = await this.operatorWalletService.validateTonSignature(
      signature,
      message,
      address,
    );

    const responseData: WalletValidationResponseData = {
      isValid,
    };

    return new WalletValidationResponse(responseData);
  }

  @ApiOperation({
    summary: 'Check TON API connection',
    description: 'Verifies that the TON API connection is working properly',
  })
  @ApiResponse({
    status: 200,
    description: 'TON API connection status',
    type: TonApiStatusResponse,
  })
  @ApiResponse({
    status: 500,
    description: 'TON API connection failed',
  })
  @Get('ton-api-status')
  async checkTonApiStatus(): Promise<
    TonApiStatusResponse | ApiResponseDto<{ status: string; endpoint: string }>
  > {
    try {
      const status = await this.operatorWalletService.checkTonApiConnection();
      return new TonApiStatusResponse(status);
    } catch (error) {
      return new ApiResponseDto(500, 'TON API connection failed', {
        status: 'error',
        endpoint: error.message,
      });
    }
  }
}
