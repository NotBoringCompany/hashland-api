import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NFT, NFTStatus } from '../schemas/nft.schema';
import { Auction, AuctionStatus } from '../schemas/auction.schema';
import {
  AuctionWhitelist,
  WhitelistStatus,
} from '../schemas/auction-whitelist.schema';
import { Bid, BidStatus, BidType } from '../schemas/bid.schema';
import {
  AuctionHistory,
  AuctionAction,
} from '../schemas/auction-history.schema';
import { Operator } from '../../operators/schemas/operator.schema';

/**
 * Seeder service for auction system data
 */
@Injectable()
export class AuctionSeeder {
  private readonly logger = new Logger(AuctionSeeder.name);

  constructor(
    @InjectModel(NFT.name) private nftModel: Model<NFT>,
    @InjectModel(Auction.name) private auctionModel: Model<Auction>,
    @InjectModel(AuctionWhitelist.name)
    private whitelistModel: Model<AuctionWhitelist>,
    @InjectModel(Bid.name) private bidModel: Model<Bid>,
    @InjectModel(AuctionHistory.name)
    private historyModel: Model<AuctionHistory>,
    @InjectModel(Operator.name) private operatorModel: Model<Operator>,
  ) {}

  /**
   * Seed all auction-related data
   */
  async seedAll(): Promise<void> {
    this.logger.log('🌱 Starting auction system seeding...');

    try {
      // Clear existing data
      await this.clearData();

      // Seed in order of dependencies
      const operators = await this.seedOperators();
      const nfts = await this.seedNFTs();
      const auctions = await this.seedAuctions(nfts, operators);
      await this.seedWhitelists(auctions, operators);
      await this.seedBids(auctions, operators);
      await this.seedAuctionHistory(auctions, operators);

      this.logger.log('✅ Auction system seeding completed successfully!');
    } catch (error) {
      this.logger.error('❌ Error during seeding:', error);
      throw error;
    }
  }

  /**
   * Clear existing auction data
   */
  async clearData(): Promise<void> {
    this.logger.log('🧹 Clearing existing auction data...');

    await Promise.all([
      this.historyModel.deleteMany({}),
      this.bidModel.deleteMany({}),
      this.whitelistModel.deleteMany({}),
      this.auctionModel.deleteMany({}),
      this.nftModel.deleteMany({}),
    ]);

    this.logger.log('✅ Existing data cleared');
  }

  /**
   * Seed test operators for auction participation
   */
  async seedOperators(): Promise<Operator[]> {
    this.logger.log('👥 Seeding operators...');

    // Check if operators already exist
    const existingCount = await this.operatorModel.countDocuments();
    if (existingCount >= 20) {
      this.logger.log(
        `📊 Found ${existingCount} existing operators, using them`,
      );
      return await this.operatorModel.find().limit(20).exec();
    }

    const operators: Partial<Operator>[] = [];
    const usernames = [
      'crypto_collector',
      'nft_enthusiast',
      'digital_artist',
      'blockchain_dev',
      'art_lover',
      'tech_investor',
      'creative_mind',
      'pixel_hunter',
      'meta_trader',
      'hash_miner',
      'auction_master',
      'rare_finder',
      'token_holder',
      'web3_explorer',
      'defi_user',
      'nft_flipper',
      'crypto_whale',
      'art_curator',
      'digital_nomad',
      'future_builder',
    ];

    for (let i = 0; i < 20; i++) {
      const _id = new Types.ObjectId();
      operators.push({
        _id,
        usernameData: {
          username: usernames[i] || `test_user_${i + 1}`,
          lastRenameTimestamp: null,
        },
        assetEquity: Math.floor(Math.random() * 10000) + 1000,
        cumulativeEff: Math.floor(Math.random() * 1000) + 100,
        effMultiplier: 1 + Math.random() * 0.5,
        effCredits: Math.floor(Math.random() * 500),
        maxFuel: 100,
        currentFuel: Math.floor(Math.random() * 100) + 50,
        maxActiveDrillsAllowed: 5,
        totalEarnedHASH: Math.floor(Math.random() * 50000) + 10000,
        currentHASH: Math.floor(Math.random() * 10000) + 5000,
        holdHASH: 0,
        lastJoinedPool: null,
        tgProfile:
          Math.random() > 0.5
            ? {
                tgId: `${1000000000 + i}`,
                tgUsername: usernames[i] || `user${i + 1}`,
              }
            : null,
        walletProfile:
          Math.random() > 0.3
            ? {
                address: `0x${Math.random().toString(16).substr(2, 40)}`,
                chain: 'ETH',
              }
            : null,
        referralData: {
          referralCode: null,
          referredBy: null,
          totalReferrals: Math.floor(Math.random() * 10),
          referralRewards: {
            effCredits: Math.floor(Math.random() * 100),
            fuelBonus: Math.floor(Math.random() * 50),
            hashBonus: Math.floor(Math.random() * 1000),
          },
        },
      });
    }

    const createdOperators = await this.operatorModel.insertMany(operators);
    this.logger.log(`✅ Created ${createdOperators.length} operators`);
    return createdOperators as Operator[];
  }

  /**
   * Seed NFTs for auctions
   */
  async seedNFTs(): Promise<NFT[]> {
    this.logger.log('🎨 Seeding NFTs...');

    const nftData = [
      {
        title: 'Cosmic Dragon #001',
        description:
          'A legendary cosmic dragon with ethereal flames and starlight scales',
        imageUrl: 'https://example.com/nft/cosmic-dragon-001.jpg',
        metadata: {
          attributes: [
            { trait_type: 'Element', value: 'Cosmic' },
            { trait_type: 'Rarity', value: 'Legendary' },
            { trait_type: 'Power Level', value: 9500 },
            { trait_type: 'Generation', value: 1 },
          ],
          rarity: 'Legendary',
        },
        status: NFTStatus.ACTIVE,
      },
      {
        title: 'Mystic Forest Guardian',
        description: 'An ancient guardian protecting the mystical forest realm',
        imageUrl: 'https://example.com/nft/forest-guardian.jpg',
        metadata: {
          attributes: [
            { trait_type: 'Element', value: 'Nature' },
            { trait_type: 'Rarity', value: 'Epic' },
            { trait_type: 'Power Level', value: 7800 },
            { trait_type: 'Age', value: 'Ancient' },
          ],
          rarity: 'Epic',
        },
        status: NFTStatus.ACTIVE,
      },
      {
        title: 'Cyber Samurai Warrior',
        description: 'A futuristic samurai enhanced with cybernetic technology',
        imageUrl: 'https://example.com/nft/cyber-samurai.jpg',
        metadata: {
          attributes: [
            { trait_type: 'Element', value: 'Tech' },
            { trait_type: 'Rarity', value: 'Rare' },
            { trait_type: 'Power Level', value: 6200 },
            { trait_type: 'Weapon', value: 'Plasma Katana' },
          ],
          rarity: 'Rare',
        },
        status: NFTStatus.ACTIVE,
      },
      {
        title: 'Phoenix of Rebirth',
        description: 'A magnificent phoenix rising from golden flames',
        imageUrl: 'https://example.com/nft/phoenix-rebirth.jpg',
        metadata: {
          attributes: [
            { trait_type: 'Element', value: 'Fire' },
            { trait_type: 'Rarity', value: 'Legendary' },
            { trait_type: 'Power Level', value: 9200 },
            { trait_type: 'Ability', value: 'Resurrection' },
          ],
          rarity: 'Legendary',
        },
        status: NFTStatus.ACTIVE,
      },
      {
        title: 'Ocean Depths Leviathan',
        description: 'A colossal sea creature from the deepest ocean trenches',
        imageUrl: 'https://example.com/nft/ocean-leviathan.jpg',
        metadata: {
          attributes: [
            { trait_type: 'Element', value: 'Water' },
            { trait_type: 'Rarity', value: 'Epic' },
            { trait_type: 'Power Level', value: 8100 },
            { trait_type: 'Habitat', value: 'Deep Ocean' },
          ],
          rarity: 'Epic',
        },
        status: NFTStatus.ACTIVE,
      },
      {
        title: 'Crystal Mage Apprentice',
        description: 'A young mage learning the ancient arts of crystal magic',
        imageUrl: 'https://example.com/nft/crystal-mage.jpg',
        metadata: {
          attributes: [
            { trait_type: 'Element', value: 'Crystal' },
            { trait_type: 'Rarity', value: 'Common' },
            { trait_type: 'Power Level', value: 3400 },
            { trait_type: 'School', value: 'Apprentice' },
          ],
          rarity: 'Common',
        },
        status: NFTStatus.ACTIVE,
      },
      {
        title: 'Shadow Assassin Elite',
        description: 'A master assassin who moves through shadows unseen',
        imageUrl: 'https://example.com/nft/shadow-assassin.jpg',
        metadata: {
          attributes: [
            { trait_type: 'Element', value: 'Shadow' },
            { trait_type: 'Rarity', value: 'Rare' },
            { trait_type: 'Power Level', value: 7200 },
            { trait_type: 'Stealth', value: 'Master' },
          ],
          rarity: 'Rare',
        },
        status: NFTStatus.ACTIVE,
      },
      {
        title: 'Golden Golem Protector',
        description:
          'An ancient golem forged from pure gold to protect treasures',
        imageUrl: 'https://example.com/nft/golden-golem.jpg',
        metadata: {
          attributes: [
            { trait_type: 'Element', value: 'Earth' },
            { trait_type: 'Rarity', value: 'Epic' },
            { trait_type: 'Power Level', value: 8500 },
            { trait_type: 'Material', value: 'Pure Gold' },
          ],
          rarity: 'Epic',
        },
        status: NFTStatus.ACTIVE,
      },
      {
        title: 'Storm Caller Shaman',
        description: 'A powerful shaman who commands the fury of storms',
        imageUrl: 'https://example.com/nft/storm-shaman.jpg',
        metadata: {
          attributes: [
            { trait_type: 'Element', value: 'Lightning' },
            { trait_type: 'Rarity', value: 'Rare' },
            { trait_type: 'Power Level', value: 6800 },
            { trait_type: 'Specialty', value: 'Weather Control' },
          ],
          rarity: 'Rare',
        },
        status: NFTStatus.ACTIVE,
      },
      {
        title: 'Void Walker Phantom',
        description: 'A mysterious entity that exists between dimensions',
        imageUrl: 'https://example.com/nft/void-walker.jpg',
        metadata: {
          attributes: [
            { trait_type: 'Element', value: 'Void' },
            { trait_type: 'Rarity', value: 'Legendary' },
            { trait_type: 'Power Level', value: 9800 },
            { trait_type: 'Dimension', value: 'Between Worlds' },
          ],
          rarity: 'Legendary',
        },
        status: NFTStatus.ACTIVE,
      },
    ];

    const nfts = await this.nftModel.insertMany(nftData);
    this.logger.log(`✅ Created ${nfts.length} NFTs`);
    return nfts;
  }

  /**
   * Seed auctions with various statuses
   */
  async seedAuctions(nfts: NFT[], operators: Operator[]): Promise<Auction[]> {
    this.logger.log('🏛️ Seeding auctions...');

    const now = new Date();
    const auctions: Partial<Auction>[] = [];

    // Create auctions with different statuses
    const auctionConfigs = [
      {
        status: AuctionStatus.WHITELIST_OPEN,
        whitelistStart: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
        whitelistEnd: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 hours from now
        auctionStart: new Date(now.getTime() + 4 * 60 * 60 * 1000), // 4 hours from now
        auctionEnd: new Date(now.getTime() + 28 * 60 * 60 * 1000), // 28 hours from now
      },
      {
        status: AuctionStatus.AUCTION_ACTIVE,
        whitelistStart: new Date(now.getTime() - 6 * 60 * 60 * 1000),
        whitelistEnd: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        auctionStart: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1 hour ago
        auctionEnd: new Date(now.getTime() + 23 * 60 * 60 * 1000), // 23 hours from now
      },
      {
        status: AuctionStatus.ENDED,
        whitelistStart: new Date(now.getTime() - 72 * 60 * 60 * 1000),
        whitelistEnd: new Date(now.getTime() - 48 * 60 * 60 * 1000),
        auctionStart: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        auctionEnd: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1 hour ago
      },
      {
        status: AuctionStatus.DRAFT,
        whitelistStart: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        whitelistEnd: new Date(now.getTime() + 48 * 60 * 60 * 1000),
        auctionStart: new Date(now.getTime() + 50 * 60 * 60 * 1000),
        auctionEnd: new Date(now.getTime() + 74 * 60 * 60 * 1000),
      },
    ];

    for (let i = 0; i < Math.min(nfts.length, 10); i++) {
      const nft = nfts[i];
      const config = auctionConfigs[i % auctionConfigs.length];
      const startingPrice = Math.floor(Math.random() * 500) + 100;
      const currentBid =
        config.status === AuctionStatus.AUCTION_ACTIVE ||
        config.status === AuctionStatus.ENDED
          ? startingPrice + Math.floor(Math.random() * 1000) + 50
          : startingPrice;

      auctions.push({
        nftId: nft._id,
        title: `${nft.title} Auction`,
        description: `Exclusive auction for ${nft.title}. ${nft.description}`,
        startingPrice,
        currentHighestBid: currentBid,
        currentWinner:
          config.status === AuctionStatus.AUCTION_ACTIVE ||
          config.status === AuctionStatus.ENDED
            ? operators[Math.floor(Math.random() * operators.length)]._id
            : null,
        status: config.status,
        whitelistConfig: {
          maxParticipants: Math.floor(Math.random() * 50) + 20,
          entryFee: Math.floor(Math.random() * 50) + 10,
          startTime: config.whitelistStart,
          endTime: config.whitelistEnd,
          isActive: config.status === AuctionStatus.WHITELIST_OPEN,
        },
        auctionConfig: {
          startTime: config.auctionStart,
          endTime: config.auctionEnd,
          minBidIncrement: Math.floor(Math.random() * 20) + 10,
          reservePrice: startingPrice + Math.floor(Math.random() * 200) + 100,
          buyNowPrice:
            Math.random() > 0.5
              ? startingPrice + Math.floor(Math.random() * 2000) + 1000
              : undefined,
        },
        totalBids:
          config.status === AuctionStatus.AUCTION_ACTIVE ||
          config.status === AuctionStatus.ENDED
            ? Math.floor(Math.random() * 20) + 5
            : 0,
        totalParticipants:
          config.status === AuctionStatus.AUCTION_ACTIVE ||
          config.status === AuctionStatus.ENDED
            ? Math.floor(Math.random() * 15) + 3
            : 0,
      });
    }

    const createdAuctions = await this.auctionModel.insertMany(auctions);
    this.logger.log(`✅ Created ${createdAuctions.length} auctions`);
    return createdAuctions as Auction[];
  }

  /**
   * Seed whitelist entries
   */
  async seedWhitelists(
    auctions: Auction[],
    operators: Operator[],
  ): Promise<void> {
    this.logger.log('📝 Seeding whitelist entries...');

    const whitelists: Partial<AuctionWhitelist>[] = [];

    for (const auction of auctions) {
      if (auction.status === AuctionStatus.DRAFT) continue;

      const participantCount = Math.min(
        Math.floor(
          Math.random() * auction.whitelistConfig.maxParticipants * 0.8,
        ) + 5,
        operators.length,
      );

      const shuffledOperators = [...operators].sort(() => Math.random() - 0.5);
      const participants = shuffledOperators.slice(0, participantCount);

      for (const operator of participants) {
        whitelists.push({
          auctionId: auction._id,
          operatorId: operator._id,
          entryFeePaid: auction.whitelistConfig.entryFee,
          paymentTransactionId: new Types.ObjectId().toString(),
          status: WhitelistStatus.CONFIRMED,
          joinedAt: new Date(
            auction.whitelistConfig.startTime.getTime() +
              Math.random() *
                (auction.whitelistConfig.endTime.getTime() -
                  auction.whitelistConfig.startTime.getTime()),
          ),
        });
      }
    }

    if (whitelists.length > 0) {
      await this.whitelistModel.insertMany(whitelists);
      this.logger.log(`✅ Created ${whitelists.length} whitelist entries`);
    }
  }

  /**
   * Seed bids for active and ended auctions
   */
  async seedBids(auctions: any[], operators: any[]): Promise<void> {
    this.logger.log('💰 Seeding bids...');

    const bids: Partial<Bid>[] = [];

    for (const auction of auctions) {
      if (
        auction.status !== AuctionStatus.AUCTION_ACTIVE &&
        auction.status !== AuctionStatus.ENDED
      ) {
        continue;
      }

      const bidCount = auction.totalBids || Math.floor(Math.random() * 15) + 3;
      const shuffledOperators = [...operators].sort(() => Math.random() - 0.5);
      const bidders = shuffledOperators.slice(
        0,
        Math.min(bidCount, operators.length),
      );

      let currentAmount = auction.startingPrice;
      const increment = auction.auctionConfig.minBidIncrement;

      for (let i = 0; i < bidCount; i++) {
        const bidder = bidders[i % bidders.length];
        const bidAmount =
          currentAmount + increment + Math.floor(Math.random() * 50);
        const isWinning =
          i === bidCount - 1 &&
          auction.currentWinner?.toString() === bidder._id.toString();

        bids.push({
          auctionId: auction._id,
          bidderId: bidder._id,
          amount: bidAmount,
          bidType: Math.random() > 0.9 ? BidType.BUY_NOW : BidType.REGULAR,
          status: isWinning
            ? BidStatus.WINNING
            : i === bidCount - 1
              ? BidStatus.CONFIRMED
              : BidStatus.OUTBID,
          transactionId: new Types.ObjectId().toString(),
          metadata: {
            userAgent: 'Mozilla/5.0 (Test Browser)',
            ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
            timestamp: new Date(),
          },
        });

        currentAmount = bidAmount;
      }
    }

    if (bids.length > 0) {
      await this.bidModel.insertMany(bids);
      this.logger.log(`✅ Created ${bids.length} bids`);
    }
  }

  /**
   * Seed auction history events
   */
  async seedAuctionHistory(
    auctions: Auction[],
    operators: Operator[],
  ): Promise<void> {
    this.logger.log('📚 Seeding auction history...');

    const histories: Partial<AuctionHistory>[] = [];

    for (const auction of auctions) {
      // Whitelist opened event
      if (auction.status !== AuctionStatus.DRAFT) {
        histories.push({
          auctionId: auction._id,
          operatorId: operators[0]._id, // System operator
          action: AuctionAction.WHITELIST_OPENED,
          details: {
            metadata: {
              maxParticipants: auction.whitelistConfig.maxParticipants,
            },
          },
          timestamp: auction.whitelistConfig.startTime,
        });
      }

      // Whitelist closed event
      if (
        auction.status === AuctionStatus.AUCTION_ACTIVE ||
        auction.status === AuctionStatus.ENDED
      ) {
        histories.push({
          auctionId: auction._id,
          operatorId: operators[0]._id,
          action: AuctionAction.WHITELIST_CLOSED,
          details: {
            metadata: { totalParticipants: auction.totalParticipants },
          },
          timestamp: auction.whitelistConfig.endTime,
        });
      }

      // Auction started event
      if (
        auction.status === AuctionStatus.AUCTION_ACTIVE ||
        auction.status === AuctionStatus.ENDED
      ) {
        histories.push({
          auctionId: auction._id,
          operatorId: operators[0]._id,
          action: AuctionAction.AUCTION_STARTED,
          details: { metadata: { startingPrice: auction.startingPrice } },
          timestamp: auction.auctionConfig.startTime,
        });
      }

      // Bid events for active/ended auctions
      if (
        (auction.status === AuctionStatus.AUCTION_ACTIVE ||
          auction.status === AuctionStatus.ENDED) &&
        auction.totalBids > 0
      ) {
        const bidders = operators.slice(
          1,
          Math.min(auction.totalParticipants + 1, operators.length),
        );

        for (let i = 0; i < auction.totalBids; i++) {
          const bidder = bidders[i % bidders.length];
          const bidAmount =
            auction.startingPrice +
            (i + 1) * auction.auctionConfig.minBidIncrement +
            Math.floor(Math.random() * 50);

          histories.push({
            auctionId: auction._id,
            operatorId: bidder._id,
            action: AuctionAction.BID_PLACED,
            details: {
              amount: bidAmount,
              previousAmount:
                i === 0
                  ? auction.startingPrice
                  : bidAmount - auction.auctionConfig.minBidIncrement - 25,
            },
            timestamp: new Date(
              auction.auctionConfig.startTime.getTime() +
                (i + 1) *
                  ((Date.now() - auction.auctionConfig.startTime.getTime()) /
                    auction.totalBids),
            ),
          });
        }
      }

      // Auction ended event
      if (auction.status === AuctionStatus.ENDED) {
        histories.push({
          auctionId: auction._id,
          operatorId: auction.currentWinner || operators[0]._id,
          action: AuctionAction.AUCTION_ENDED,
          details: { amount: auction.currentHighestBid },
          timestamp: auction.auctionConfig.endTime,
        });

        if (auction.currentWinner) {
          histories.push({
            auctionId: auction._id,
            operatorId: auction.currentWinner,
            action: AuctionAction.AUCTION_WON,
            details: { amount: auction.currentHighestBid },
            timestamp: auction.auctionConfig.endTime,
          });
        }
      }
    }

    if (histories.length > 0) {
      await this.historyModel.insertMany(histories);
      this.logger.log(`✅ Created ${histories.length} history entries`);
    }
  }

  /**
   * Seed specific auction status
   */
  async seedAuctionsByStatus(
    status: AuctionStatus,
    count: number = 5,
  ): Promise<void> {
    this.logger.log(`🎯 Seeding ${count} auctions with status: ${status}`);

    const nfts = await this.nftModel.find().limit(count);
    const operators = await this.operatorModel.find().limit(10);

    if (nfts.length === 0 || operators.length === 0) {
      throw new Error('No NFTs or operators found. Please seed them first.');
    }

    const now = new Date();
    const auctions: Partial<Auction>[] = [];

    for (let i = 0; i < Math.min(count, nfts.length); i++) {
      const nft = nfts[i];
      let config;

      switch (status) {
        case AuctionStatus.DRAFT:
          config = {
            whitelistStart: new Date(now.getTime() + 24 * 60 * 60 * 1000),
            whitelistEnd: new Date(now.getTime() + 48 * 60 * 60 * 1000),
            auctionStart: new Date(now.getTime() + 50 * 60 * 60 * 1000),
            auctionEnd: new Date(now.getTime() + 74 * 60 * 60 * 1000),
          };
          break;
        case AuctionStatus.WHITELIST_OPEN:
          config = {
            whitelistStart: new Date(now.getTime() - 2 * 60 * 60 * 1000),
            whitelistEnd: new Date(now.getTime() + 2 * 60 * 60 * 1000),
            auctionStart: new Date(now.getTime() + 4 * 60 * 60 * 1000),
            auctionEnd: new Date(now.getTime() + 28 * 60 * 60 * 1000),
          };
          break;
        case AuctionStatus.AUCTION_ACTIVE:
          config = {
            whitelistStart: new Date(now.getTime() - 6 * 60 * 60 * 1000),
            whitelistEnd: new Date(now.getTime() - 2 * 60 * 60 * 1000),
            auctionStart: new Date(now.getTime() - 1 * 60 * 60 * 1000),
            auctionEnd: new Date(now.getTime() + 23 * 60 * 60 * 1000),
          };
          break;
        case AuctionStatus.ENDED:
          config = {
            whitelistStart: new Date(now.getTime() - 72 * 60 * 60 * 1000),
            whitelistEnd: new Date(now.getTime() - 48 * 60 * 60 * 1000),
            auctionStart: new Date(now.getTime() - 24 * 60 * 60 * 1000),
            auctionEnd: new Date(now.getTime() - 1 * 60 * 60 * 1000),
          };
          break;
        default:
          throw new Error(`Unsupported auction status: ${status}`);
      }

      const startingPrice = Math.floor(Math.random() * 500) + 100;

      auctions.push({
        nftId: nft._id,
        title: `${nft.title} Special Auction`,
        description: `Special ${status} auction for ${nft.title}`,
        startingPrice,
        currentHighestBid:
          status === AuctionStatus.AUCTION_ACTIVE ||
          status === AuctionStatus.ENDED
            ? startingPrice + Math.floor(Math.random() * 500) + 50
            : startingPrice,
        currentWinner:
          status === AuctionStatus.AUCTION_ACTIVE ||
          status === AuctionStatus.ENDED
            ? operators[Math.floor(Math.random() * operators.length)]._id
            : null,
        status,
        whitelistConfig: {
          maxParticipants: Math.floor(Math.random() * 50) + 20,
          entryFee: Math.floor(Math.random() * 50) + 10,
          startTime: config.whitelistStart,
          endTime: config.whitelistEnd,
          isActive: status === AuctionStatus.WHITELIST_OPEN,
        },
        auctionConfig: {
          startTime: config.auctionStart,
          endTime: config.auctionEnd,
          minBidIncrement: Math.floor(Math.random() * 20) + 10,
          reservePrice: startingPrice + Math.floor(Math.random() * 200) + 100,
          buyNowPrice:
            Math.random() > 0.5
              ? startingPrice + Math.floor(Math.random() * 2000) + 1000
              : undefined,
        },
        totalBids:
          status === AuctionStatus.AUCTION_ACTIVE ||
          status === AuctionStatus.ENDED
            ? Math.floor(Math.random() * 20) + 5
            : 0,
        totalParticipants:
          status === AuctionStatus.AUCTION_ACTIVE ||
          status === AuctionStatus.ENDED
            ? Math.floor(Math.random() * 15) + 3
            : 0,
      });
    }

    await this.auctionModel.insertMany(auctions);
    this.logger.log(`✅ Created ${auctions.length} ${status} auctions`);
  }
}
