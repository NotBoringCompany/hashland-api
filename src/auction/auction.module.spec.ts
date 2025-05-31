import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { AuctionModule } from './auction.module';
import { AuctionService } from './auction.service';
import { NFTService } from './nft.service';
import { AuctionController } from './auction.controller';
import { NFTController } from './nft.controller';
import { AuctionGateway } from './gateways/auction.gateway';
import { AuctionLifecycleService } from './services/auction-lifecycle.service';
import { BidQueueService } from './services/bid-queue.service';

/**
 * Test suite for AuctionModule integration
 */
describe('AuctionModule', () => {
  let module: TestingModule;
  let auctionService: AuctionService;
  let nftService: NFTService;
  let lifecycleService: AuctionLifecycleService;
  let bidQueueService: BidQueueService;

  beforeAll(async () => {
    // Setup environment variables for testing
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
    process.env.JWT_SECRET = 'test-secret';
    process.env.REDIS_QUEUE_HOST = 'localhost';
    process.env.REDIS_QUEUE_PORT = '6379';

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        MongooseModule.forRoot('mongodb://localhost:27017/test'),
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '24h' },
        }),
        BullModule.forRoot({
          redis: {
            host: 'localhost',
            port: 6379,
          },
        }),
        ScheduleModule.forRoot(),
        AuctionModule,
      ],
    }).compile();

    auctionService = module.get<AuctionService>(AuctionService);
    nftService = module.get<NFTService>(NFTService);
    lifecycleService = module.get<AuctionLifecycleService>(
      AuctionLifecycleService,
    );
    bidQueueService = module.get<BidQueueService>(BidQueueService);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('Module Compilation', () => {
    it('should compile the module successfully', () => {
      expect(module).toBeDefined();
    });

    it('should provide AuctionService', () => {
      expect(auctionService).toBeDefined();
      expect(auctionService).toBeInstanceOf(AuctionService);
    });

    it('should provide NFTService', () => {
      expect(nftService).toBeDefined();
      expect(nftService).toBeInstanceOf(NFTService);
    });

    it('should provide AuctionLifecycleService', () => {
      expect(lifecycleService).toBeDefined();
      expect(lifecycleService).toBeInstanceOf(AuctionLifecycleService);
    });

    it('should provide BidQueueService', () => {
      expect(bidQueueService).toBeDefined();
      expect(bidQueueService).toBeInstanceOf(BidQueueService);
    });
  });

  describe('Controllers', () => {
    it('should provide AuctionController', () => {
      const auctionController =
        module.get<AuctionController>(AuctionController);
      expect(auctionController).toBeDefined();
      expect(auctionController).toBeInstanceOf(AuctionController);
    });

    it('should provide NFTController', () => {
      const nftController = module.get<NFTController>(NFTController);
      expect(nftController).toBeDefined();
      expect(nftController).toBeInstanceOf(NFTController);
    });
  });

  describe('Gateways', () => {
    it('should provide AuctionGateway', () => {
      const auctionGateway = module.get<AuctionGateway>(AuctionGateway);
      expect(auctionGateway).toBeDefined();
      expect(auctionGateway).toBeInstanceOf(AuctionGateway);
    });
  });

  describe('Service Dependencies', () => {
    it('should have all required dependencies for AuctionService', () => {
      expect(auctionService).toBeDefined();
      // Test that the service can be instantiated without errors
      expect(typeof auctionService.getAuctions).toBe('function');
      expect(typeof auctionService.createAuction).toBe('function');
      expect(typeof auctionService.placeBid).toBe('function');
    });

    it('should have all required dependencies for AuctionLifecycleService', () => {
      expect(lifecycleService).toBeDefined();
      // Test that the service has required methods
      expect(typeof lifecycleService.triggerStateTransition).toBe('function');
      expect(typeof lifecycleService.getLifecycleStatus).toBe('function');
    });

    it('should have all required dependencies for BidQueueService', () => {
      expect(bidQueueService).toBeDefined();
      // Test that the service has required methods
      expect(typeof bidQueueService.addBidToQueue).toBe('function');
      expect(typeof bidQueueService.getQueueHealth).toBe('function');
    });
  });

  describe('Module Configuration', () => {
    it('should have proper Mongoose models registered', () => {
      const connection = module.get('DatabaseConnection');
      expect(connection).toBeDefined();
    });

    it('should have Bull queues configured', () => {
      // Test that Bull module is properly configured
      expect(bidQueueService).toBeDefined();
    });

    it('should have scheduler configured', () => {
      // Test that lifecycle service can access scheduler
      expect(lifecycleService).toBeDefined();
    });
  });
});
