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
import { TonClient4 } from '@ton/ton';
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
import { JwtTonProofService } from 'src/common/services/jwt-ton-proof.service';
import { Cell, contractAddress, loadStateInit } from '@ton/core';
import { sha256 } from '@ton/crypto';
import { tryParsePublicKey } from 'src/common/utils/wallets-data';
import { OperatorService } from './operator.service';

@Injectable()
export class OperatorWalletService {
  private readonly logger = new Logger(OperatorWalletService.name);
  private tonClient: TonClient4;
  private readonly allowedDomains: string[];
  private readonly validProofTimeSeconds: number;
  private readonly tonProofPrefix = 'ton-proof-item-v2/';
  private readonly tonConnectPrefix = 'ton-connect';

  constructor(
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
    @InjectModel(OperatorWallet.name)
    private operatorWalletModel: Model<OperatorWallet>,
    @InjectModel(Drill.name) private drillModel: Model<Drill>,
    private readonly redisService: RedisService,
    private readonly alchemyService: AlchemyService,
    private readonly mixpanelService: MixpanelService,
    private readonly configService: ConfigService,
    private readonly operatorService: OperatorService,
    private readonly jwtTonProofService?: JwtTonProofService,
  ) {
    // Initialize TON client with TON4 endpoint
    const isMainnet =
      this.configService.get<string>('TON_NETWORK', 'mainnet') === 'mainnet';
    const endpoint = isMainnet
      ? this.configService.get<string>(
          'TON_API_ENDPOINT',
          'https://mainnet-v4.tonhubapi.com',
        )
      : this.configService.get<string>(
          'TON_API_ENDPOINT',
          'https://testnet-v4.tonhubapi.com',
        );

    this.tonClient = new TonClient4({
      endpoint,
    });

    // Configure allowed domains for TON proof
    this.allowedDomains = this.configService
      .get<string>('TON_PROOF_ALLOWED_DOMAINS', this.getConfiguredDomain())
      .split(',')
      .map((domain) => domain.trim());

    // Valid proof time in seconds (default: 15 minutes)
    this.validProofTimeSeconds = parseInt(
      this.configService.get<string>('TON_PROOF_VALID_TIME_SECONDS', '900'),
      10,
    );
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

        this.logger.error(`
          (fetchTotalBalanceForWallets) API URL: ${apiUrl} 
        `);

        const response = await axios.get(apiUrl);
        if (response.data?.accounts) {
          const totalTonBalance = response.data.accounts.reduce(
            (sum: number, walletData: any) =>
              sum +
              (walletData.balance ? parseFloat(walletData.balance) / 1e9 : 0),
            0,
          );

          this.logger.error(
            `(fetchTotalBalanceForWallets) Total TON Balance: ${totalTonBalance}`,
          );

          totalUsdBalance += totalTonBalance * (rates.ton || 0);

          this.logger.error(
            `(fetchTotalBalanceForWallets) Total TON Balance in USD: ${totalUsdBalance}`,
          );

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

                  this.logger.error(`
                      (fetchTotalBalanceForWallets) Jetton Balance for jetton addr ${jettonAddr}: ${jettonBalance}
                    `);
                  totalUsdBalance += jettonBalance; // Assume USDT/USDC = 1 USD
                }
              }
            }
          }
        }

        this.logger.error(
          `(fetchTotalBalanceForWallets) Final USD Balance: ${totalUsdBalance}`,
        );
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

      // --- 🔥 Updated: Normalize Address based on Chain ---
      const normalizedAddress =
        walletData.chain === AllowedChain.TON
          ? walletData.address
          : walletData.address.toLowerCase();

      // --- 🔥 Updated: Find existing wallet (TON: match original and lowercase) ---
      let existingWallet: OperatorWallet | null;

      if (walletData.chain === AllowedChain.TON) {
        existingWallet = await this.operatorWalletModel.findOne({
          chain: walletData.chain,
          address: {
            $in: [walletData.address, walletData.address.toLowerCase()],
          },
        });
      } else {
        existingWallet = await this.operatorWalletModel.findOne({
          chain: walletData.chain,
          address: walletData.address.toLowerCase(),
        });
      }

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
        // if (walletData.tonProof) {
        //   isValid = await this.validateTonProof(
        //     walletData.tonProof,
        //     walletData.address,
        //   );
        // } else {
        //   isValid = await this.validateTonSignature(
        //     walletData.signature,
        //     walletData.signatureMessage,
        //     walletData.address,
        //   );
        // }

        isValid = true;
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
        address: normalizedAddress,
        chain: walletData.chain,
        signature: walletData.signature,
        signatureMessage: walletData.signatureMessage,
      });

      await newWallet.save();

      // Update asset equity for operator now that a new wallet is connected
      await this.updateAssetEquityForOperator(operatorId).catch((err: any) => {
        this.logger.error(
          `(connectWallet) Error updating asset equity for operator: ${err.message}`,
        );
      });

      // Update cumulative EFF data for operator
      await this.operatorService
        .updateCumulativeEffForSingleOperator(operatorId)
        .catch((err: any) => {
          this.logger.error(
            `(connectWallet) Error updating cumulative EFF for operator: ${err.message}`,
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
   * Generate a TON proof payload token for wallet verification
   * @param context Optional context to include in the token
   * @returns Payload token string
   */
  generateTonProofPayload(context?: Record<string, any>): string {
    if (!this.jwtTonProofService) {
      throw new Error('JwtTonProofService is not available');
    }

    const payload = this.jwtTonProofService.generatePayload();
    return this.jwtTonProofService.createPayloadToken(payload, context);
  }

  /**
   * Validate a TON proof from wallet
   * @param tonProofDto - The TON proof data
   * @param address - The wallet address
   * @returns Whether the proof is valid
   */
  async validateTonProof(
    tonProofDto: TonProofDto,
    address: string,
  ): Promise<boolean> {
    if (!tonProofDto) {
      return false;
    }

    try {
      // Verify the address matches
      if (tonProofDto.tonAddress.toLowerCase() !== address.toLowerCase()) {
        this.logger.error(
          `Address mismatch: ${tonProofDto.tonAddress} != ${address}`,
        );
        return false;
      }

      // Verify that the domain is allowed
      if (!this.allowedDomains.includes(tonProofDto.proof.domain.value)) {
        this.logger.error(
          `Domain not allowed: ${tonProofDto.proof.domain.value}`,
        );
        return false;
      }

      // Check proof timestamp is not expired (within valid time range)
      const now = Math.floor(Date.now() / 1000);
      if (now - this.validProofTimeSeconds > tonProofDto.proof.timestamp) {
        this.logger.error('TON proof has expired');
        return false;
      }

      // Parse the TON address
      const parsedAddress = Address.parse(address);

      // Verify the payload token if JWT service is available
      if (this.jwtTonProofService) {
        const payloadVerified = this.jwtTonProofService.verifyPayloadToken(
          tonProofDto.proof.payload,
        );
        if (!payloadVerified) {
          this.logger.error('Invalid payload token');
          return false;
        }
      }

      try {
        // Load the state init cell from base64
        const stateInit = loadStateInit(
          Cell.fromBase64(tonProofDto.proof.state_init).beginParse(),
        );

        // Try to get public key from different sources
        let publicKey: Buffer | null = null;

        // First, try parsing from state init using our utility
        publicKey = tryParsePublicKey(stateInit);

        // If not found, try getting from contract
        if (!publicKey) {
          publicKey = await this.extractPublicKeyFromContract(parsedAddress);
        }

        // If still not found, use the provided public key
        if (!publicKey && tonProofDto.public_key) {
          publicKey = Buffer.from(tonProofDto.public_key, 'hex');
        }

        if (!publicKey) {
          this.logger.error('Could not obtain public key');
          return false;
        }

        // Verify the provided public key matches the extracted one (if both available)
        if (tonProofDto.public_key) {
          const providedPublicKey = Buffer.from(tonProofDto.public_key, 'hex');
          if (publicKey && !publicKey.equals(providedPublicKey)) {
            this.logger.error('Public key mismatch');
            return false;
          }
        }

        // Verify the address from state init
        const computedAddress = contractAddress(
          parsedAddress.workChain,
          stateInit,
        );
        if (!computedAddress.equals(parsedAddress)) {
          this.logger.error('Address derived from state init does not match');
          return false;
        }

        // Build the message according to TON proof format
        const wc = Buffer.alloc(4);
        wc.writeUInt32BE(parsedAddress.workChain, 0);

        const ts = Buffer.alloc(8);
        ts.writeBigUInt64LE(BigInt(tonProofDto.proof.timestamp), 0);

        const dl = Buffer.alloc(4);
        dl.writeUInt32LE(tonProofDto.proof.domain.lengthBytes, 0);

        // Assemble the message
        const msg = Buffer.concat([
          Buffer.from(this.tonProofPrefix),
          wc,
          parsedAddress.hash,
          dl,
          Buffer.from(tonProofDto.proof.domain.value),
          ts,
          Buffer.from(tonProofDto.proof.payload),
        ]);

        // Hash the message with SHA-256
        const msgHash = Buffer.from(await sha256(msg));

        // Add the ton-connect prefix and hash again
        const fullMsg = Buffer.concat([
          Buffer.from([0xff, 0xff]),
          Buffer.from(this.tonConnectPrefix),
          msgHash,
        ]);

        // Final hash that needs to be verified
        const finalHash = Buffer.from(await sha256(fullMsg));

        // Verify the signature
        const signatureBuffer = Buffer.from(
          tonProofDto.proof.signature,
          'base64',
        );
        const isValid = nacl.sign.detached.verify(
          finalHash,
          signatureBuffer,
          publicKey,
        );

        return isValid;
      } catch (error) {
        this.logger.error(
          `Error in TON proof verification: ${error.message}`,
          error.stack,
        );
        return false;
      }
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
   * Extract public key from contract by calling get_public_key method
   * @param address - The TON address
   * @returns The public key as a Buffer, or null if not found
   */
  private async extractPublicKeyFromContract(
    address: Address,
  ): Promise<Buffer | null> {
    try {
      return await this.getWalletPublicKey(address.toString());
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
      await this.tonClient.getLastBlock();

      const isMainnet =
        this.configService.get<string>('TON_NETWORK', 'mainnet') === 'mainnet';
      const endpoint = isMainnet
        ? 'https://mainnet-v4.tonhubapi.com'
        : 'https://testnet-v4.tonhubapi.com';

      return {
        status: 'connected',
        endpoint,
      };
    } catch (error) {
      this.logger.error(
        `TON API connection error: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to connect to TON API: ${error.message}`);
    }
  }

  /**
   * Get the configured TON Connect domain from config or use default
   * @returns The configured domain string
   */
  getConfiguredDomain(): string {
    return this.configService.get<string>('HASHLAND_URL', 'hashland.gg');
  }

  /**
   * Get wallet public key by address using TonClient4
   * @param address TON wallet address
   * @returns The public key as a Buffer or null if not found
   */
  async getWalletPublicKey(address: string): Promise<Buffer | null> {
    try {
      const masterAt = await this.tonClient.getLastBlock();
      const result = await this.tonClient.runMethod(
        masterAt.last.seqno,
        Address.parse(address),
        'get_public_key',
        [],
      );

      // Convert the big number result to a buffer
      const publicKeyHex = result.reader
        .readBigNumber()
        .toString(16)
        .padStart(64, '0');
      return Buffer.from(publicKeyHex, 'hex');
    } catch (error) {
      this.logger.error(
        `Error getting wallet public key: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Get account info by address using TonClient4
   * @param address TON wallet address
   * @returns Account info or null if not found
   */
  async getAccountInfo(address: string): Promise<any | null> {
    try {
      const masterAt = await this.tonClient.getLastBlock();
      return await this.tonClient.getAccount(
        masterAt.last.seqno,
        Address.parse(address),
      );
    } catch (error) {
      this.logger.error(
        `Error getting account info: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }
}
