import {
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
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
import { ByteArray, keccak256, recoverAddress, Signature, toBytes } from 'viem';
import { AlchemyService } from 'src/alchemy/alchemy.service';
import { GAME_CONSTANTS } from 'src/common/constants/game.constants';
import { MixpanelService } from 'src/mixpanel/mixpanel.service';
import { EVENT_CONSTANTS } from 'src/common/constants/mixpanel.constants';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OperatorWalletService {
  private readonly logger = new Logger(OperatorWalletService.name);
  private tonClient: TonClient;

  constructor(
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
    @InjectModel(OperatorWallet.name)
    private operatorWalletModel: Model<OperatorWallet>,
    @InjectModel(Drill.name) private drillModel: Model<Drill>,
    private readonly redisService: RedisService,
    private readonly alchemyService: AlchemyService,
    private readonly mixpanelService: MixpanelService,
    private readonly configService: ConfigService,
  ) {
    // Initialize TON client
    const endpoint =
      this.configService.get<string>('TON_API_ENDPOINT') ||
      'https://toncenter.com/api/v2/jsonRPC';
    const apiKey = this.configService.get<string>('TON_API_KEY') || '';

    this.logger.log(
      `[Constructor] Initializing TON client with endpoint: ${endpoint}`,
    );
    this.logger.debug(
      `[Constructor] TON API Key: ${
        apiKey
          ? apiKey.substring(0, 4) +
            '***' +
            (apiKey.length > 8 ? apiKey.substring(apiKey.length - 4) : '')
          : 'not set'
      }`,
    );

    // Force the API key to be included
    const tonClientConfig = {
      endpoint,
      apiKey,
    };

    // Make sure apiKey is not undefined or empty
    if (!tonClientConfig.apiKey) {
      this.logger.warn(
        '[Constructor] No TON API key found in configuration. API requests may be rate limited.',
      );
    }

    this.tonClient = new TonClient(tonClientConfig);

    // Log full client configuration (excluding sensitive data)
    this.logger.debug(
      `[Constructor] TON client initialized with parameters: ${JSON.stringify({
        endpoint: this.tonClient.parameters.endpoint,
        apiKey: this.tonClient.parameters.apiKey ? 'set (masked)' : 'not set',
        apiKeyLength: this.tonClient.parameters.apiKey
          ? this.tonClient.parameters.apiKey.length
          : 0,
        timeout: this.tonClient.parameters.timeout,
      })}`,
    );

    // Try a simple API call to verify connectivity
    this.checkTonApiConnection()
      .then((status) => {
        this.logger.log(
          `[Constructor] TON API connection test: ${status.status}`,
        );
      })
      .catch((error) => {
        this.logger.error(
          `[Constructor] TON API connection test failed: ${error.message}`,
        );
      });
  }

  /**
   * Updates asset equity, effMultiplier (in Operator) and actualEff for basic drills in the Operator schema.
   *
   * Does NOT update `cumulativeEff`. This needs to be done separately.
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

      this.logger.debug(
        `(updateAssetEquityForOperator) New equity: ${newEquity}`,
      );

      // ✅ Step 3: Fetch operator document
      const operator = await this.operatorModel
        .findById(operatorId, { assetEquity: 1 })
        .lean();
      if (!operator) return;

      // ✅ Step 4: Compute `effMultiplier`
      const newEffMultiplier = equityToEffMultiplier(newEquity);

      this.logger.debug(
        `(updateAssetEquityForOperator) New effMultiplier: ${newEffMultiplier}`,
      );

      // ✅ Step 5: Update `actualEff` of **Basic Drill**
      const newActualEff = equityToActualEff(newEquity);

      this.logger.debug(
        `(updateAssetEquityForOperator) New actualEff: ${newActualEff}`,
      );

      await this.drillModel.findOneAndUpdate(
        { operatorId, version: DrillVersion.BASIC },
        { $set: { actualEff: newActualEff } },
        { new: false, projection: { actualEff: 1 } }, // Return the old `actualEff` (with `new: false`)
      );

      // ✅ Step 6: Update `assetEquity` and `effMultiplier` in Operator document
      await this.operatorModel.updateOne(
        { _id: operatorId },
        {
          $set: {
            assetEquity: newEquity,
            effMultiplier: newEffMultiplier,
          },
        },
      );

      this.mixpanelService.track(EVENT_CONSTANTS.WALLET_UPDATE_ASSET_EQUITY, {
        distinct_id: operatorId,
        wallets: walletDocuments,
        assetEquity: newEquity,
      });

      this.logger.debug(
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

      // ✅ Group wallet addresses by chain
      const chainWalletsMap: Partial<Record<AllowedChain, string[]>> = {};
      for (const wallet of wallets) {
        if (!chainWalletsMap[wallet.chain]) {
          chainWalletsMap[wallet.chain] = [];
        }
        chainWalletsMap[wallet.chain]!.push(wallet.address);
      }

      // ✅ Fetch exchange rates once
      const rates = await this.fetchEligibleTokenRates();

      // ✅ TON Chain Handling
      if (chainWalletsMap[AllowedChain.TON]?.length) {
        const tonApiKey = this.configService.get<string>('TON_API_KEY') || '';
        const apiUrl =
          `https://toncenter.com/api/v3/accountStates?include_boc=false&api_key=${tonApiKey}&` +
          chainWalletsMap[AllowedChain.TON]!.map(
            (addr) => `address=${addr}`,
          ).join('&');

        const response = await axios.get(apiUrl);
        if (response.data?.accounts) {
          const totalTonBalance = response.data.accounts.reduce(
            (sum: number, walletData: any) =>
              sum +
              (walletData.balance ? parseFloat(walletData.balance) / 1e9 : 0),
            0,
          );

          totalUsdBalance += totalTonBalance * (rates.ton || 0);

          const tonXApiKey =
            this.configService.get<string>('TON_X_API_KEY') || '';
          const tonXApiUrl = `https://mainnet-rpc.tonxapi.com/v2/json-rpc/${tonXApiKey}`;

          const requests = chainWalletsMap[AllowedChain.TON]!.map(
            (addr, index) => ({
              id: index + 1,
              jsonrpc: '2.0',
              method: 'getAccountJettonsBalances',
              params: { account_id: addr },
            }),
          );

          const batchResponses = await axios.all(
            requests.map((body) =>
              axios.post(tonXApiUrl, body, {
                headers: { 'Content-Type': 'application/json' },
              }),
            ),
          );

          const allowedJettonAddresses = new Set([
            '0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe', // USDT
            '0:7e30fc2b7751ba58a3642f3fd59d5e96a810ddd78d8a310bfe8353bef10500df', // USDC
          ]);

          for (const response of batchResponses) {
            if (response.data?.result?.balances) {
              for (const balanceData of response.data.result.balances) {
                const jettonAddr = balanceData.jetton?.address;
                if (allowedJettonAddresses.has(jettonAddr)) {
                  const jettonBalance =
                    parseFloat(balanceData.balance) /
                    Math.pow(10, balanceData.jetton.decimals || 9);
                  totalUsdBalance += jettonBalance; // Assume USDT/USDC = 1 USD
                }
              }
            }
          }
        }
      }

      // ✅ BERA Chain Handling
      if (chainWalletsMap[AllowedChain.BERA]?.length) {
        const beraRate = rates.bera || 0;

        for (const address of chainWalletsMap[AllowedChain.BERA]) {
          const balances =
            await this.alchemyService.getEligibleBERATokenBalances(address);

          for (const tokenData of balances) {
            const { token, balance } = tokenData;

            if (token === 'USDT' || token === 'USDC') {
              totalUsdBalance += parseFloat(balance); // $1 stablecoins
            } else if (token === 'BERA') {
              totalUsdBalance += parseFloat(balance) * beraRate;
            }
          }
        }
      }

      // If totalUsdBalance is < MINIMUM_USD_BALANCE_THRESHOLD, set it to 0
      if (
        totalUsdBalance < GAME_CONSTANTS.ECONOMY.MINIMUM_USD_BALANCE_THRESHOLD
      ) {
        totalUsdBalance = 0;
      }

      return totalUsdBalance;
    } catch (error) {
      this.logger.error(
        `❌ (fetchTotalBalanceForWallets) Error: ${error.message}`,
      );
      return 0;
    }
  }

  /**
   * Fetches the latest exchange rates from Binance for eligible token rates (that will be read for asset equity) and caches them in Redis.
   *
   * Returns an object like: { ton: 3.6, bera: 6.73 }
   */
  async fetchEligibleTokenRates(): Promise<{ ton: number; bera: number }> {
    const tonCacheKey = 'ton-usd-rate';
    const beraCacheKey = 'bera-usd-rate';
    const lockKey = 'token-usd-rate:lock';
    const expiryInSeconds = 300; // Cache TTL: 5 mins

    try {
      // ✅ Try fetching from cache first
      const [cachedTon, cachedBera] = await Promise.all([
        this.redisService.get(tonCacheKey),
        this.redisService.get(beraCacheKey),
      ]);

      const tonRate = cachedTon ? parseFloat(cachedTon) : null;
      const beraRate = cachedBera ? parseFloat(cachedBera) : null;

      if (tonRate !== null && beraRate !== null) {
        return { ton: tonRate, bera: beraRate };
      }

      // ✅ Avoid race conditions using Redis lock
      const lock = await this.redisService.get(lockKey);
      if (lock) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.fetchEligibleTokenRates(); // Retry
      }

      await this.redisService.set(lockKey, '1', 5); // Lock for 5s

      // ✅ Fetch from Binance API
      const response = await axios.get(
        'https://data-api.binance.vision/api/v3/ticker/price?symbols=["BERAUSDT","TONUSDT"]',
      );

      const prices = response.data || [];

      // Default fallback values
      let finalTon = 10;
      let finalBera = 10;

      for (const token of prices) {
        if (token.symbol === 'TONUSDT') finalTon = parseFloat(token.price);
        if (token.symbol === 'BERAUSDT') finalBera = parseFloat(token.price);
      }

      // ✅ Cache values
      await Promise.all([
        this.redisService.set(
          tonCacheKey,
          finalTon.toString(),
          expiryInSeconds,
        ),
        this.redisService.set(
          beraCacheKey,
          finalBera.toString(),
          expiryInSeconds,
        ),
        this.redisService.set(lockKey, '', 1), // Unlock
      ]);

      return { ton: finalTon, bera: finalBera };
    } catch (error) {
      this.logger.error(
        `❌ (fetchTonAndBeraRates) Failed to fetch token rates: ${error.message}`,
      );
      return { ton: 10, bera: 10 }; // Fallback values
    }
  }

  /**
   * Connect a wallet to an operator
   * @param operatorId - The operator's ID
   * @param walletData - The wallet connection data
   * @returns The connected wallet's ID
   */
  async connectWallet(
    operatorId: Types.ObjectId,
    walletData: ConnectWalletDto,
  ): Promise<Types.ObjectId> {
    try {
      // Check if operator exists
      const operator = await this.operatorModel.findById(operatorId);
      if (!operator) {
        throw new NotFoundException('(connectWallet) Operator not found');
      }

      // Allow up to 2 connected wallets per chain.
      // We will check if the operator already has one or more wallets in the same chain.
      const existingWalletsInChain = await this.operatorWalletModel.find({
        operatorId,
        chain: walletData.chain,
      });

      if (existingWalletsInChain.length >= 2) {
        throw new HttpException(
          '(connectWallet) Operator already has maximum connected wallets in this chain',
          400,
        );
      }

      // If the operator is connecting a second wallet.
      // If yes, we need to set a minimum asset equity check (in USD) to allow them to connect their wallet.
      if (existingWalletsInChain.length === 1) {
        const minAssetEquity = 100;

        const secondWalletUSDBalance = await this.fetchTotalBalanceForWallets([
          {
            address: walletData.address,
            chain: walletData.chain as AllowedChain, // Explicitly cast to AllowedChain
          },
        ]);

        if (secondWalletUSDBalance < minAssetEquity) {
          throw new HttpException(
            `(connectWallet) Operator must have at least $${minAssetEquity} in their second wallet to connect it.`,
            400,
          );
        }
      }

      // Check if wallet is already connected to this operator for this chain
      const existingWallet = await this.operatorWalletModel.findOne({
        address: walletData.address.toLowerCase(),
        chain: walletData.chain,
      });

      if (
        existingWallet &&
        existingWallet.operatorId.toString() !== operatorId.toString()
      ) {
        throw new HttpException(
          '(connectWallet) Wallet already connected to another operator',
          400,
        );
      }

      // Validate wallet ownership first, before making any updates
      let isValid = false;

      if (walletData.chain === AllowedChain.TON) {
        if (walletData.tonProof) {
          isValid = await this.validateTonProof(
            walletData.tonProof,
            walletData.address,
          );
        } else {
          isValid = await this.validateTonSignature(
            walletData.signature,
            walletData.signatureMessage,
            walletData.address,
          );
        }
      } else if (walletData.chain === AllowedChain.BERA) {
        isValid = await this.validateEVMSignature(
          walletData.signatureMessage,
          walletData.signature as `0x${string}`,
          walletData.address,
        );
      }

      if (!isValid) {
        throw new HttpException(
          '(connectWallet) Invalid wallet signature or proof.',
          400,
        );
      }

      if (existingWallet) {
        // Update the existing wallet with new signature after validation
        existingWallet.signature = walletData.signature;
        existingWallet.signatureMessage = walletData.signatureMessage;
        await existingWallet.save();

        this.mixpanelService.track(EVENT_CONSTANTS.WALLET_CONNECT, {
          distinct_id: operatorId,
          wallet: existingWallet,
        });
        return existingWallet._id;
      }

      // Create new wallet after validation
      const newWallet = new this.operatorWalletModel({
        operatorId,
        address: walletData.address.toLowerCase(),
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

      this.mixpanelService.track(EVENT_CONSTANTS.WALLET_CONNECT, {
        distinct_id: operatorId,
        wallet: newWallet,
      });

      return newWallet._id;
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
    this.logger.log(
      `[validateTonProof] Starting validation for address: ${address}`,
    );

    if (!tonProof) {
      this.logger.warn(
        `[validateTonProof] No tonProof data provided for address: ${address}`,
      );
      return false;
    }

    try {
      this.logger.debug(
        `[validateTonProof] TON proof data: ${JSON.stringify({
          tonAddress: tonProof.tonAddress,
          timestamp: tonProof.proof.timestamp,
          domain: tonProof.proof.domain,
        })}`,
      );

      // Verify the address matches
      if (tonProof.tonAddress.toLowerCase() !== address.toLowerCase()) {
        this.logger.warn(
          `[validateTonProof] Address mismatch: ${tonProof.tonAddress} ≠ ${address}`,
        );
        return false;
      }

      // Check if proof is expired (24 hours)
      const proofTimestamp = tonProof.proof.timestamp;
      const currentTimestamp = Math.floor(Date.now() / 1000);
      if (currentTimestamp - proofTimestamp > 86400) {
        this.logger.warn(
          `[validateTonProof] Proof expired: ${currentTimestamp - proofTimestamp}s old (max 86400s)`,
        );
        return false;
      }

      // Verify the signature
      const tonAddress = Address.parse(address);
      this.logger.debug(
        `[validateTonProof] Parsed TON address: ${tonAddress.toString()}`,
      );

      const publicKey = await this.extractPublicKeyFromContract(tonAddress);

      if (!publicKey) {
        this.logger.error(
          `[validateTonProof] Failed to extract public key for address: ${address}`,
        );
        return false;
      }

      this.logger.debug(
        `[validateTonProof] Extracted public key: ${publicKey.toString('hex')}`,
      );

      // Convert signature from hex to buffer
      const signatureBuffer = Buffer.from(tonProof.proof.signature, 'hex');
      this.logger.debug(
        `[validateTonProof] Signature length: ${signatureBuffer.length} bytes`,
      );

      // Create payload hash
      const payloadBuffer = Buffer.from(tonProof.proof.payload);
      this.logger.debug(
        `[validateTonProof] Payload length: ${payloadBuffer.length} bytes`,
      );

      // Verify the signature
      const isValid = this.verifySignature(
        publicKey,
        payloadBuffer,
        signatureBuffer,
      );

      this.logger.log(
        `[validateTonProof] Signature validation result for address ${address}: ${isValid}`,
      );
      return isValid;
    } catch (error) {
      this.logger.error(
        `[validateTonProof] Error validating TON proof for ${address}: ${error.message}`,
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
   * Validate a signature signed by any EVM wallet address
   * @param message - The message that was signed
   * @param signature - The signature
   * @param address - The wallet address
   * @param chain - The chain the wallet is signed on
   */
  async validateEVMSignature(
    message: string,
    signature: `0x${string}` | ByteArray | Signature,
    address: string | `0x${string}`,
  ): Promise<boolean> {
    if (!message || !signature || !address) return false;

    try {
      this.logger.debug(`Validating EVM signature for address: ${address}`);
      this.logger.debug(`Message: ${message}`);
      this.logger.debug(`Signature: ${signature}`);

      // Prepare the message hash with proper EIP-191 prefixing
      // Use the same method that wallets use: \x19Ethereum Signed Message:\n<length><message>
      const stringMessage = String(message); // Ensure message is a string
      const prefixedMessage = `\x19Ethereum Signed Message:\n${stringMessage.length}${stringMessage}`;

      // Hash the properly prefixed message
      const messageHash = keccak256(toBytes(prefixedMessage));

      // Recover the address from the signature
      const recoveredAddress = await recoverAddress({
        hash: messageHash,
        signature: signature as `0x${string}`,
      });

      this.logger.debug(`Recovered address: ${recoveredAddress}`);
      this.logger.debug(`Expected address: ${address}`);

      // Compare the recovered address with the provided address
      const isValid = recoveredAddress.toLowerCase() === address.toLowerCase();
      this.logger.debug(`Signature validation result: ${isValid}`);

      return isValid;
    } catch (err: any) {
      this.logger.error(
        `(validateEVMSignature) Error validating EVM signature: ${err.message}`,
        err.stack,
      );
      return false;
    }
  }

  /**
   * Generates a message when users want to link an EVM wallet to their account.
   */
  requestEVMSignatureMessage(walletAddress: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const hashSalt = this.generateHashSalt();

    const rawMessage = `
    Please sign the following message to link your wallet.
    Wallet address: ${walletAddress}
    Timestamp: ${timestamp}
    Hash salt: ${hashSalt}
    `.trim();

    return rawMessage;
  }

  /**
   * Generates a random hash salt for cryptographic operations.
   */
  private generateHashSalt(): string {
    // Generate 32 random bytes and convert to hex string
    const salt = crypto.randomBytes(32).toString('hex');

    // Compute the keccak256 hash using viem
    return keccak256(toBytes(salt));
  }

  /**
   * Extract public key from contract by calling various get methods
   * @param address - The TON address
   * @returns The public key as a Buffer, or null if not found
   */
  private async extractPublicKeyFromContract(
    address: Address,
  ): Promise<Buffer | null> {
    this.logger.log(
      `[extractPublicKeyFromContract] Attempting to extract public key for address: ${address.toString()}`,
    );

    // Log TON client configuration
    const clientConfig = {
      endpoint: this.tonClient.parameters.endpoint,
      hasApiKey: Boolean(this.tonClient.parameters.apiKey),
      apiKeyLength: this.tonClient.parameters.apiKey
        ? this.tonClient.parameters.apiKey.length
        : 0,
    };

    this.logger.debug(
      `[extractPublicKeyFromContract] TON client config: ${JSON.stringify(clientConfig)}`,
    );

    // Different wallet types use different get methods for public key
    const possibleMethods = [
      'get_public_key',
      'get_wallet_public_key',
      'public_key',
      'publicKey',
    ];

    // Try each method in sequence
    for (const method of possibleMethods) {
      try {
        this.logger.debug(
          `[extractPublicKeyFromContract] Trying method '${method}' on address: ${address.toString()}`,
        );

        // Add a timeout for better error diagnostics
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error('API call timeout after 10s')),
            10000,
          );
        });

        const resultPromise = this.tonClient.runMethod(address, method);
        const result = (await Promise.race([
          resultPromise,
          timeoutPromise,
        ])) as any;

        this.logger.debug(
          `[extractPublicKeyFromContract] '${method}' result: ${JSON.stringify(
            result,
            (key, value) =>
              typeof value === 'bigint' ? value.toString() : value,
          )}`,
        );

        // Check if result exists and has a stack
        if (result && result.stack) {
          try {
            // The stack is a TupleReader, not an array, so we need to read from it
            // Get the first item from the stack (the public key)
            const publicKeyBigInt = result.stack.readBigNumber();
            const publicKeyHex = publicKeyBigInt.toString(16).padStart(64, '0');
            const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex');

            this.logger.debug(
              `[extractPublicKeyFromContract] Extracted public key from method '${method}': ${publicKeyHex}`,
            );
            return publicKeyBuffer;
          } catch (stackError) {
            this.logger.debug(
              `[extractPublicKeyFromContract] Error reading stack from '${method}': ${stackError.message}`,
            );
            // Continue to next method if stack reading fails
          }
        } else {
          this.logger.debug(
            `[extractPublicKeyFromContract] No usable stack found in '${method}' result`,
          );
        }
      } catch (methodError) {
        // Only log as debug since we're trying multiple methods
        this.logger.debug(
          `[extractPublicKeyFromContract] Method '${method}' failed: ${methodError.message}`,
        );

        // If it's a method not found error (exit code -13), this is expected
        if (
          methodError.message &&
          methodError.message.includes('exit_code: -13')
        ) {
          this.logger.debug(
            `[extractPublicKeyFromContract] Method '${method}' not found in contract, trying next method...`,
          );
        }
        // Continue to next method
      }
    }

    // If we've tried all methods and none worked, log an error
    this.logger.error(
      `[extractPublicKeyFromContract] Failed to extract public key using any method for address: ${address.toString()}`,
    );

    // Try alternative approach: get raw contract data
    try {
      this.logger.debug(
        `[extractPublicKeyFromContract] Attempting to get contract state for address: ${address.toString()}`,
      );
      const contract = await this.tonClient.getContractState(address);
      this.logger.debug(
        `[extractPublicKeyFromContract] Contract type: ${contract.state}`,
      );

      if (contract.data) {
        this.logger.debug(
          `[extractPublicKeyFromContract] Contract has data of length: ${contract.data.length} bytes`,
        );
      }

      // For now, we can't extract the public key from raw data,
      // but this information might help with debugging
    } catch (error) {
      this.logger.error(
        `[extractPublicKeyFromContract] Failed to get contract state: ${error.message}`,
      );
    }

    return null;
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
    const appName = this.configService.get<string>('APP_NAME', 'Hashland');
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
        endpoint: this.configService.get<string>(
          'TON_API_ENDPOINT',
          'https://toncenter.com/api/v2/jsonRPC',
        ),
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
