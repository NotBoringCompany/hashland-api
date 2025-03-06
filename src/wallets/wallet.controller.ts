import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Delete,
  Param,
  Get,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { WalletService } from './services/wallet.service';
import { WalletSignatureValidator } from './utils/wallet-signature-validator';
import { JwtAuthGuard } from '../auth/jwt/jwt-auth.guard';
import { WalletConnectionRequest } from './interfaces/wallet.interface';
import { ApiResponse } from '../common/dto/response.dto';
import { WalletConnectionResponse } from './interfaces/wallet.interface';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiTags,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Wallets')
@Controller('wallets')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly walletSignatureValidator: WalletSignatureValidator,
  ) {}

  /**
   * Generate a challenge message for wallet signature
   */
  @ApiOperation({
    summary: 'Generate Signature Message',
    description:
      'Generates a challenge message for wallet signature verification',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['address', 'type'],
      properties: {
        address: {
          type: 'string',
          description: 'Wallet address',
          example: '0x1234567890abcdef1234567890abcdef12345678',
        },
        type: {
          type: 'string',
          example: 'hex',
        },
      },
    },
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Message generated successfully',
  })
  @SwaggerApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiBearerAuth()
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

  @ApiOperation({
    summary: 'Connect Wallet',
    description: 'Connects a wallet to an operator account',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['operatorId', 'walletType', 'connectionData'],
      properties: {
        operatorId: {
          type: 'string',
          description: 'ID of the operator to connect the wallet to',
          example: '60d21b4667d1c878a7',
        },
        walletType: {
          type: 'string',
          description: 'Type of wallet (e.g., ethereum, telegram)',
          example: 'telegram',
        },
        connectionData: {
          type: 'object',
          description: 'Wallet-specific connection data',
          example: {
            address: '0x1234567890abcdef1234567890abcdef12345678',
            signature: '0x1234567890abcdef1234567890abcdef12345678',
            message: 'Sign this message to connect your wallet',
          },
        },
      },
    },
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Wallet connected successfully',
  })
  @SwaggerApiResponse({
    status: 400,
    description:
      'Bad request - Invalid connection data or operator ID mismatch',
  })
  @SwaggerApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiBearerAuth()
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

  @ApiOperation({
    summary: 'Disconnect Wallet',
    description: 'Disconnects a wallet from an operator account',
  })
  @ApiParam({
    name: 'walletId',
    description: 'ID of the wallet to disconnect',
    required: true,
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Wallet disconnected successfully',
  })
  @SwaggerApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Wallet not found',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':walletId')
  async disconnectWallet(
    @Param('walletId') walletId: string,
    @Request() req,
  ): Promise<ApiResponse<boolean>> {
    const operatorId = req.user.operatorId;
    return this.walletService.disconnectWallet(walletId, operatorId);
  }

  @ApiOperation({
    summary: 'Validate Wallet',
    description: 'Validates a wallet connection',
  })
  @ApiParam({
    name: 'walletId',
    description: 'ID of the wallet to validate',
    required: true,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['address', 'message', 'signature'],
      properties: {
        address: {
          type: 'string',
          description: 'Address of the wallet that need to validated',
          example: '60d21b4667d1c878a7',
        },
        message: {
          type: 'string',
          description: 'Signature message from generator',
          example:
            '8e2de04cd8a21f4225815850194f9cd1702ff1177c97c6458f48eebcf9fc7cf3',
        },
        signature: {
          type: 'string',
          description: 'Signature from Wallet authentication',
          example:
            'signaturefrom8e2de04cd8a21f4225815850194f9cd1702ff1177c97c6458f48eebcf9fc7cf3',
        },
      },
    },
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Wallet validated successfully',
  })
  @SwaggerApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Wallet not found',
  })
  @ApiBearerAuth()
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

  @ApiOperation({
    summary: 'Get All Wallets',
    description: 'Retrieves all wallets connected to the operator',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Wallets retrieved successfully',
  })
  @SwaggerApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  async getWallets(
    @Request() req,
  ): Promise<ApiResponse<WalletConnectionResponse[]>> {
    const operatorId = req.user.operatorId;
    return this.walletService.getWalletsForOperator(operatorId);
  }

  @ApiOperation({
    summary: 'Get Wallet',
    description: 'Retrieves a specific wallet by ID',
  })
  @ApiParam({
    name: 'walletId',
    description: 'ID of the wallet to retrieve',
    required: true,
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Wallet retrieved successfully',
  })
  @SwaggerApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Wallet not found',
  })
  @ApiBearerAuth()
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

  @ApiOperation({
    summary: 'Get Wallet Events',
    description: 'Retrieves events for a specific wallet',
  })
  @ApiParam({
    name: 'walletId',
    description: 'ID of the wallet to get events for',
    required: true,
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Wallet events retrieved successfully',
  })
  @SwaggerApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Wallet not found',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':walletId/events')
  async getWalletEvents(
    @Param('walletId') walletId: string,
    @Request() req,
  ): Promise<ApiResponse<any>> {
    const operatorId = req.user.operatorId;
    return this.walletService.getWalletEvents(walletId, operatorId);
  }

  @ApiOperation({
    summary: 'Get Wallet Balance',
    description: 'Retrieves the balance for a specific wallet',
  })
  @ApiParam({
    name: 'walletId',
    description: 'ID of the wallet to get balance for',
    required: true,
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Wallet balance retrieved successfully',
  })
  @SwaggerApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @SwaggerApiResponse({
    status: 404,
    description: 'Wallet not found',
  })
  @ApiBearerAuth()
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
