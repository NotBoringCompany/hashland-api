import {
  Injectable,
  Logger,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Operator } from '../operators/schemas/operator.schema';
import { OperatorWallet } from '../operators/schemas/operator-wallet.schema';
import { OperatorService } from 'src/operators/operator.service';
import { OperatorWalletService } from 'src/operators/operator-wallet.service';
import { AuthenticatedResponse } from '../common/dto/auth.dto';
import { AllowedChain } from 'src/common/enums/chain.enum';
import { ApiResponse } from '../common/dto/response.dto';
import { WalletLoginDto } from '../common/dto/wallet-auth.dto';

/**
 * Service handling wallet-based authentication
 */
@Injectable()
export class WalletAuthService {
  private readonly logger = new Logger(WalletAuthService.name);

  constructor(
    private jwtService: JwtService,
    private operatorService: OperatorService,
    private operatorWalletService: OperatorWalletService,
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
    @InjectModel(OperatorWallet.name)
    private operatorWalletModel: Model<OperatorWallet>,
  ) {}

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
   * Authenticate an operator using wallet signature
   * @param walletLoginData - Wallet login data
   * @returns AuthenticatedResponse with operator details and access token
   */
  async walletLogin(
    walletLoginData: WalletLoginDto,
  ): Promise<AuthenticatedResponse> {
    try {
      this.logger.log(
        `Wallet login attempt for address: ${walletLoginData.address}`,
      );

      // Validate the wallet signature
      const isValid = await this.validateWalletSignature(
        walletLoginData.message,
        walletLoginData.signature,
        walletLoginData.address,
        walletLoginData.chain,
      );

      if (!isValid) {
        this.logger.warn(
          `Invalid signature for address: ${walletLoginData.address}`,
        );
        throw new UnauthorizedException('Invalid wallet signature');
      }

      // Find existing operator wallet
      let wallet = await this.operatorWalletModel.findOne({
        address: walletLoginData.address,
        chain: walletLoginData.chain,
      });

      let operator: Operator | null;

      if (!wallet) {
        this.logger.log(
          `Wallet not found, creating new operator for: ${walletLoginData.address}`,
        );

        // Generate a username based on the wallet address
        const username = `user_${walletLoginData.address.substring(0, 8).toLowerCase()}`;

        // Create a new operator
        operator = await this.operatorService.findOrCreateOperator({
          id: walletLoginData.address.substring(0, 8),
          username,
          walletAddress: walletLoginData.address,
          walletChain: walletLoginData.chain,
        });

        // Create wallet record
        wallet = await this.operatorWalletModel.create({
          operatorId: operator._id,
          address: walletLoginData.address,
          chain: walletLoginData.chain,
          signature: walletLoginData.signature,
          signatureMessage: walletLoginData.message,
        });
      } else {
        // Find the operator using the wallet's operatorId
        operator = await this.operatorModel.findById(wallet.operatorId);
        if (!operator) {
          this.logger.warn(
            `Operator not found for wallet: ${walletLoginData.address}`,
          );
          throw new UnauthorizedException('Operator not found');
        }
      }

      // Update asset equity
      await this.operatorWalletService.updateAssetEquityForOperator(
        operator._id,
      );

      // Generate access token
      const accessToken = this.generateToken({ _id: operator._id });

      return new AuthenticatedResponse({
        operator,
        accessToken,
      });
    } catch (error) {
      this.logger.error(`Error in wallet login: ${error.message}`);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new InternalServerErrorException(
        new ApiResponse<null>(
          500,
          `Error authenticating with wallet: ${error.message}`,
        ),
      );
    }
  }

  /**
   * Validates a wallet signature based on the chain
   * @param message - The message that was signed
   * @param signature - The signature to verify
   * @param address - The wallet address
   * @param chain - The blockchain network
   * @returns Promise<boolean> indicating if the signature is valid
   */
  private async validateWalletSignature(
    message: string,
    signature: string,
    address: string,
    chain: string,
  ): Promise<boolean> {
    try {
      switch (chain) {
        case AllowedChain.TON:
          return await this.operatorWalletService.validateTonSignature(
            signature,
            message,
            address,
          );

        case AllowedChain.ETH:
        case AllowedChain.BERA:
          // All EVM-compatible chains use the same signature verification
          return await this.operatorWalletService.validateEVMSignature(
            message,
            signature as `0x${string}`,
            address as `0x${string}`,
          );

        default:
          this.logger.warn(
            `Unsupported chain for signature validation: ${chain}`,
          );
          return false;
      }
    } catch (error) {
      this.logger.error(`Error validating wallet signature: ${error.message}`);
      return false;
    }
  }
}
