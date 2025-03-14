import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { Address, beginCell } from '@ton/core';
import { TonClient } from '@ton/ton';
import * as nacl from 'tweetnacl';
import { Operator } from './schemas/operator.schema';
import { OperatorWallet } from './schemas/operator-wallet.schema';
import { ConnectWalletDto, TonProofDto } from '../common/dto/wallet.dto';
import axios from 'axios';
import { RedisService } from 'src/common/redis.service';
import { AllowedChain } from 'src/common/enums/chain.enum';
import { Drill } from 'src/drills/schemas/drill.schema';
import { DrillVersion } from 'src/common/enums/drill.enum';
import {
  equityToActualEff,
  equityToEffMultiplier,
} from 'src/common/utils/equity';

@Injectable()
export class OperatorWalletService {
  private readonly logger = new Logger(OperatorWalletService.name);
  private tonClient: TonClient;

  // ✅ Explicitly defined batch size and max requests per second (for fetching TON balance)
  private readonly batchSize = 1024; // Max 1024 wallets per request
  private readonly maxRequestsPerSecond = 10; // API rate limit: 10 requests/sec
  private readonly tonPriceApi = `https://data-api.binance.vision/api/v3/ticker/price?symbols=[%22TONUSDT%22]`;

  constructor(
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
    @InjectModel(OperatorWallet.name)
    private operatorWalletModel: Model<OperatorWallet>,
    @InjectModel(Drill.name) private drillModel: Model<Drill>,
    private readonly redisService: RedisService,
  ) {
    // Initialize TON client
    const endpoint =
      process.env.TON_API_ENDPOINT || 'https://toncenter.com/api/v2/jsonRPC';
    const apiKey = process.env.TON_API_KEY || '';

    this.tonClient = new TonClient({
      endpoint,
      apiKey,
    });
  }

  /**
   * Updates asset equity, effMultiplier (in Operator), actualEff for basic drills,
   * and adjusts cumulativeEff in the Operator schema.
   */
  async updateAssetEquityForOperator(
    operatorId: Types.ObjectId,
  ): Promise<void> {
    try {
      this.logger.log(
        `🔄 (updateAssetEquityForOperator) Updating asset equity for operator ${operatorId}...`,
      );

      // ✅ Step 1: Fetch the operator's wallets **including chains**
      const walletDocuments = await this.operatorWalletModel
        .find({ operatorId }, { address: 1, chain: 1 }) // Include chain
        .lean();

      if (walletDocuments.length === 0) {
        this.logger.log(
          `⚠️ (updateAssetEquityForOperator) Operator ${operatorId} has no wallets.`,
        );
        return;
      }

      // ✅ Step 2: Fetch total balance in USD (handles multiple chains)
      const newEquity = await this.fetchTotalBalanceForWallets(
        walletDocuments.map((wallet) => ({
          address: wallet.address,
          chain: wallet.chain as AllowedChain, // Explicitly cast to AllowedChain
        })),
      );

      // ✅ Step 3: Fetch operator document
      const operator = await this.operatorModel
        .findById(operatorId, { assetEquity: 1, cumulativeEff: 1 })
        .lean();
      if (!operator) return;

      // ✅ Step 4: Compute `effMultiplier`
      const newEffMultiplier = equityToEffMultiplier(newEquity);

      // ✅ Step 5: Update `actualEff` of **Basic Drill** & Compute `cumulativeEff`
      const newActualEff = equityToActualEff(newEquity);

      const updatedDrill = await this.drillModel.findOneAndUpdate(
        { operatorId, version: DrillVersion.BASIC },
        { $set: { actualEff: newActualEff } },
        { new: true, projection: { actualEff: 1 } }, // Return the updated `actualEff`
      );

      // ✅ Step 6: Compute `cumulativeEff`
      const oldActualEff = updatedDrill ? updatedDrill.actualEff : 0;
      const effDifference = newActualEff - oldActualEff;
      const newCumulativeEff = (operator.cumulativeEff || 0) + effDifference;

      // ✅ Step 7: Update `assetEquity`, `effMultiplier` & `cumulativeEff` in Operator document
      await this.operatorModel.updateOne(
        { _id: operatorId },
        {
          $set: {
            assetEquity: newEquity,
            effMultiplier: newEffMultiplier,
            cumulativeEff: newCumulativeEff,
          },
        },
      );

      this.logger.log(
        `✅ (updateAssetEquityForOperator) Updated asset equity & effMultiplier for operator ${operatorId}.`,
      );
    } catch (error) {
      this.logger.error(
        `❌ (updateAssetEquityForOperator) Error: ${error.message}`,
      );
    }
  }

  /**
   * Fetches the total USD balance for a list of wallets based on specific assets held.
   */
  async fetchTotalBalanceForWallets(
    wallets: { address: string; chain: AllowedChain }[],
  ): Promise<number> {
    if (wallets.length === 0) return 0;

    try {
      let totalUsdBalance = 0;

      // ✅ Organize wallets by chain
      const chainWalletsMap: Partial<Record<AllowedChain, string[]>> = {};
      for (const wallet of wallets) {
        if (!chainWalletsMap[wallet.chain]) {
          chainWalletsMap[wallet.chain] = [];
        }
        chainWalletsMap[wallet.chain]!.push(wallet.address);
      }

      // ✅ Step 1: Fetch TON/USD Price (Avoid multiple API calls)
      let tonUsdRate = 10; // Default to 10 in case of failure
      try {
        tonUsdRate = await this.fetchTonToUsdRate();
      } catch (err: any) {
        this.logger.warn(
          `⚠️ (fetchTotalBalanceForWallets) Failed to fetch TON/USD rate. Defaulting to 1. Error: ${err.message}`,
        );
      }

      if (chainWalletsMap[AllowedChain.TON]?.length) {
        const tonApiKey = process.env.TON_API_KEY || '';
        const tonXApiKey = process.env.TON_X_API_KEY || '';
        const tonXApiUrl = `https://mainnet-rpc.tonxapi.com/v2/json-rpc/${tonXApiKey}`;

        // ✅ Step 2: Fetch Native TON Balances (Single API Call)
        const tonBalanceApiUrl =
          `https://toncenter.com/api/v3/accountStates?include_boc=false&api_key=${tonApiKey}&` +
          chainWalletsMap[AllowedChain.TON]!.map(
            (addr) => `address=${addr}`,
          ).join('&');

        let totalTonBalance = 0;
        try {
          const tonResponse = await axios.get(tonBalanceApiUrl);
          if (tonResponse.data?.accounts) {
            totalTonBalance = tonResponse.data.accounts.reduce(
              (sum: number, walletData: any) =>
                sum +
                (walletData.balance ? parseFloat(walletData.balance) / 1e9 : 0), // Convert from nanotons to TON
              0,
            );
          }
        } catch (err: any) {
          this.logger.warn(
            `⚠️ (fetchTotalBalanceForWallets) Failed to fetch TON balances. Error: ${err.message}`,
          );
        }

        totalUsdBalance += totalTonBalance * tonUsdRate;

        // ✅ Step 3: Batch Fetch Jetton Balances (Optimized)
        const requests = chainWalletsMap[AllowedChain.TON]!.map(
          (addr, index) => ({
            id: index + 1,
            jsonrpc: '2.0',
            method: 'getAccountJettonsBalances',
            params: { account_id: addr },
          }),
        );

        const allowedJettonAddresses = new Set([
          '0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe', // USDT
          '0:7e30fc2b7751ba58a3642f3fd59d5e96a810ddd78d8a310bfe8353bef10500df', // USDC
        ]);

        // ✅ Step 4: Execute Batch Requests with Parallel Execution
        const batchJettonResponses = await Promise.allSettled(
          requests.map((body) =>
            axios.post(tonXApiUrl, body, {
              headers: { 'Content-Type': 'application/json' },
            }),
          ),
        );

        // ✅ Step 5: Process Jetton Balances More Efficiently
        const totalJettonUsdBalance = batchJettonResponses.reduce(
          (sum, response) => {
            if (
              response.status === 'fulfilled' &&
              response.value?.data?.result?.balances
            ) {
              const balances = response.value.data.result.balances;
              return (
                sum +
                balances.reduce((innerSum, balanceData) => {
                  const jettonAddr = balanceData.jetton?.address; // Get jetton contract address
                  if (allowedJettonAddresses.has(jettonAddr)) {
                    return (
                      innerSum +
                      parseFloat(balanceData.balance) /
                        Math.pow(10, balanceData.jetton.decimals || 9) // Convert to correct decimal format
                    );
                  }
                  return innerSum;
                }, 0)
              );
            }
            return sum;
          },
          0,
        );

        // ✅ Step 6: Add Jetton Balance to Total USD Balance
        totalUsdBalance += totalJettonUsdBalance; // USDT/USDC ≈ 1 USD
      }

      // Add other chains here...

      return totalUsdBalance;
    } catch (error) {
      this.logger.error(
        `❌ (fetchTotalBalanceForWallets) Error: ${error.message}`,
      );
      return 0;
    }
  }

  /**
   * Fetches the latest TON/USD exchange rate from a cached Redis value.
   */
  async fetchTonToUsdRate(): Promise<number> {
    try {
      const cacheKey = 'ton-usd-rate';
      const lockKey = 'ton-usd-rate:lock';
      const expiryInSeconds = 300;

      // Check cache first
      const cachedRate = await this.redisService.get(cacheKey);
      if (cachedRate) return parseFloat(cachedRate);

      // Check if another request is already fetching the price
      const lock = await this.redisService.get(lockKey);
      if (lock) {
        // Wait and retry (polling mechanism, can be optimized further)
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.fetchTonToUsdRate(); // Retry fetching
      }

      // Set lock to prevent duplicate API calls
      await this.redisService.set(lockKey, '1', 5); // Lock expires in 5 seconds

      // Fetch from API if cache is expired
      const response = await axios.get(this.tonPriceApi);
      const tonToUsdRate = response.data?.price
        ? parseFloat(response.data.price)
        : 10;

      // Store new value and remove the lock
      await this.redisService.set(
        cacheKey,
        tonToUsdRate.toString(),
        expiryInSeconds,
      );
      await this.redisService.set(lockKey, '', 1); // Unlock

      return tonToUsdRate;
    } catch (error) {
      this.logger.error(`❌ Error fetching TON price: ${error.message}`);
      return 1;
    }
  }

  /**
   * Connect a wallet to an operator
   * @param operatorId - The operator's ID
   * @param walletData - The wallet connection data
   * @returns The connected wallet
   */
  async connectWallet(
    operatorId: Types.ObjectId,
    walletData: ConnectWalletDto,
  ): Promise<OperatorWallet> {
    try {
      // Check if operator exists
      const operator = await this.operatorModel.findById(operatorId);
      if (!operator) {
        throw new NotFoundException('(connectWallet) Operator not found');
      }

      // Check if operator already has a connected wallet in the same chain
      const existingWalletInChain = await this.operatorWalletModel.exists({
        operatorId,
        chain: walletData.chain,
      });

      if (!!existingWalletInChain) {
        throw new UnauthorizedException(
          '(connectWallet) Operator already has a connected wallet in this chain',
        );
      }

      // Check if wallet is already connected to this operator
      const existingWallet = await this.operatorWalletModel.findOne({
        operatorId,
        address: walletData.address,
        chain: walletData.chain,
      });

      if (existingWallet) {
        // Update the existing wallet with new signature
        existingWallet.signature = walletData.signature;
        existingWallet.signatureMessage = walletData.signatureMessage;
        await existingWallet.save();
        return existingWallet;
      }

      // Validate wallet ownership
      let isValid = false;

      // If TON proof is provided, validate it
      if (walletData.tonProof) {
        isValid = await this.validateTonProof(
          walletData.tonProof,
          walletData.address,
        );
      } else {
        // Otherwise validate the signature
        isValid = await this.validateTonSignature(
          walletData.signature,
          walletData.signatureMessage,
          walletData.address,
        );
      }

      if (!isValid) {
        throw new UnauthorizedException(
          '(connectWallet) Invalid wallet signature or proof.',
        );
      }

      // Create new wallet
      const newWallet = new this.operatorWalletModel({
        operatorId,
        address: walletData.address,
        chain: walletData.chain,
        signature: walletData.signature,
        signatureMessage: walletData.signatureMessage,
      });

      await newWallet.save();

      // Update asset equity for operator now that a new wallet is connected
      this.updateAssetEquityForOperator(operatorId).catch((err: any) => {
        this.logger.error(
          `(connectWallet) Error updating asset equity for operator: ${err.message}`,
        );
      });

      return newWallet;
    } catch (error) {
      this.logger.error(
        `(connectWallet) Error connecting wallet: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get all wallets for an operator
   * @param operatorId - The operator's ID
   * @returns Array of operator wallets
   */
  async getOperatorWallets(
    operatorId: Types.ObjectId,
    projection?: Record<string, number>,
  ): Promise<OperatorWallet[]> {
    try {
      return this.operatorWalletModel.find({ operatorId }, projection).lean();
    } catch (error) {
      this.logger.error(
        `Error getting operator wallets: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Disconnect a wallet from an operator
   * @param operatorId - The operator's ID
   * @param walletId - The wallet's ID
   * @returns The disconnected wallet
   */
  async disconnectWallet(
    operatorId: Types.ObjectId,
    walletId: Types.ObjectId,
  ): Promise<OperatorWallet> {
    try {
      const wallet = await this.operatorWalletModel.findOneAndDelete({
        _id: walletId,
        operatorId,
      });

      if (!wallet) {
        throw new NotFoundException(
          'Wallet not found or not owned by operator',
        );
      }

      return wallet;
    } catch (error) {
      this.logger.error(
        `Error disconnecting wallet: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Generate a proof challenge for wallet validation
   * @param address - The wallet address
   * @returns The challenge message and nonce
   */
  generateProofChallenge(address: string): { message: string; nonce: string } {
    const nonce = this.generateNonce();
    const message = this.generateChallengeMessage(address, nonce);
    return { message, nonce };
  }

  /**
   * Validate a TON proof from Telegram wallet
   * @param tonProof - The TON proof data
   * @param address - The wallet address
   * @returns Whether the proof is valid
   */
  async validateTonProof(
    tonProof: TonProofDto,
    address: string,
  ): Promise<boolean> {
    if (!tonProof) {
      return false;
    }

    try {
      // Verify the address matches
      if (tonProof.tonAddress.toLowerCase() !== address.toLowerCase()) {
        return false;
      }

      // Check if proof is expired (24 hours)
      const proofTimestamp = tonProof.proof.timestamp;
      const currentTimestamp = Math.floor(Date.now() / 1000);
      if (currentTimestamp - proofTimestamp > 86400) {
        return false;
      }

      // Verify domain
      // const appDomain = this.configService.get<string>(
      //   'APP_DOMAIN',
      //   'hashland.ton.app',
      // );
      // if (tonProof.proof.domain.value !== appDomain) {
      //   return false;
      // }

      // Verify the signature
      const tonAddress = Address.parse(address);
      const publicKey = await this.extractPublicKeyFromContract(tonAddress);

      if (!publicKey) {
        this.logger.error(
          `Could not extract public key for address: ${address}`,
        );
        return false;
      }

      // Convert signature from hex to buffer
      const signatureBuffer = Buffer.from(tonProof.proof.signature, 'hex');

      // Create payload hash
      const payloadBuffer = Buffer.from(tonProof.proof.payload);

      // Verify the signature
      const isValid = this.verifySignature(
        publicKey,
        payloadBuffer,
        signatureBuffer,
      );

      return isValid;
    } catch (error) {
      this.logger.error(
        `Error validating TON proof: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Validate a TON signature
   * @param signature - The signature
   * @param message - The message that was signed
   * @param address - The wallet address
   * @returns Whether the signature is valid
   */
  async validateTonSignature(
    signature: string,
    message: string,
    address: string,
  ): Promise<boolean> {
    if (!signature || !message || !address) {
      return false;
    }

    try {
      // Check if message timestamp is valid
      if (!this.isMessageTimestampValid(message)) {
        return false;
      }

      // Convert address string to TON Address object
      const tonAddress = Address.parse(address);

      // Create a cell with the message
      const messageCell = beginCell()
        .storeBuffer(Buffer.from(message))
        .endCell();

      // Extract public key from contract state
      const publicKey = await this.extractPublicKeyFromContract(tonAddress);

      if (!publicKey) {
        this.logger.error(
          `Could not extract public key for address: ${address}`,
        );
        return false;
      }

      // Convert signature from hex to buffer
      const signatureBuffer = Buffer.from(signature, 'hex');

      // Verify the signature using the public key
      const isValid = this.verifySignature(
        publicKey,
        messageCell.hash(),
        signatureBuffer,
      );

      return isValid;
    } catch (error) {
      this.logger.error(
        `Error validating TON signature: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Extract public key from contract by calling get_public_key method
   * @param address - The TON address
   * @returns The public key as a Buffer, or null if not found
   */
  private async extractPublicKeyFromContract(
    address: Address,
  ): Promise<Buffer | null> {
    try {
      // For v3R1 and v3R2 wallets, you can use get methods to extract the public key
      const result = await this.tonClient.runMethod(address, 'get_public_key');

      // Check if result exists and has a stack
      if (result && result.stack) {
        // The stack is a TupleReader, not an array, so we need to read from it
        // Get the first item from the stack (the public key)
        const publicKeyBigInt = result.stack.readBigNumber();
        const publicKeyHex = publicKeyBigInt.toString(16).padStart(64, '0');
        return Buffer.from(publicKeyHex, 'hex');
      }

      return null;
    } catch (error) {
      this.logger.error(
        `Error extracting public key: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Verify a signature using TweetNaCl
   * @param publicKey - The public key
   * @param messageHash - The message hash
   * @param signature - The signature
   * @returns Whether the signature is valid
   */
  private verifySignature(
    publicKey: Buffer,
    messageHash: Buffer,
    signature: Buffer,
  ): boolean {
    try {
      // Use TweetNaCl to verify the signature
      return nacl.sign.detached.verify(messageHash, signature, publicKey);
    } catch (error) {
      this.logger.error(
        `Error in signature verification: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Generate a nonce for wallet validation
   * @returns A random hex string
   */
  private generateNonce(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate a challenge message for wallet validation
   * @param address - The wallet address
   * @param nonce - The nonce
   * @returns The challenge message
   */
  private generateChallengeMessage(address: string, nonce: string): string {
    const appName = process.env.APP_NAME || 'Hashland';
    const timestamp = Date.now();

    return `${appName} authentication request for address ${address}.\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
  }

  /**
   * Verify that a message was signed within a valid timeframe
   * @param message - The message
   * @param maxAgeMinutes - The maximum age in minutes
   * @returns Whether the message timestamp is valid
   */
  private isMessageTimestampValid(
    message: string,
    maxAgeMinutes = 10,
  ): boolean {
    try {
      // Extract timestamp from message
      const timestampMatch = message.match(/Timestamp: (\d+)/);
      if (!timestampMatch || !timestampMatch[1]) {
        return false;
      }

      const messageTimestamp = parseInt(timestampMatch[1], 10);
      const currentTimestamp = Date.now();
      const maxAgeMs = maxAgeMinutes * 60 * 1000;

      return currentTimestamp - messageTimestamp <= maxAgeMs;
    } catch (error) {
      this.logger.error(
        `Error validating message timestamp: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Check if the TON API connection is working
   * @returns Status information about the TON API connection
   */
  async checkTonApiConnection(): Promise<{ status: string; endpoint: string }> {
    try {
      // Try to get masterchain info as a simple test
      await this.tonClient.getMasterchainInfo();

      return {
        status: 'connected',
        endpoint:
          process.env.TON_API_ENDPOINT ||
          'https://toncenter.com/api/v2/jsonRPC',
      };
    } catch (error) {
      this.logger.error(
        `TON API connection error: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to connect to TON API: ${error.message}`);
    }
  }
}
