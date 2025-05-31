import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { Types } from 'mongoose';
import { AppModule } from '../src/app.module';
import { AuctionStatus } from '../src/auction/schemas/auction.schema';
import { NFTStatus } from '../src/auction/schemas/nft.schema';
import { BidType } from '../src/auction/schemas/bid.schema';

/**
 * End-to-end tests for the Auction System
 */
describe('Auction System (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let nftId: string;
  let auctionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        MongooseModule.forRoot('mongodb://localhost:27017/test-auction'),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Setup test authentication token
    // Note: This would typically involve creating a test user and getting a JWT
    authToken = 'test-jwt-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('NFT Management', () => {
    it('/nfts (POST) - should create a new NFT', async () => {
      const createNftDto = {
        title: 'Test NFT for Auction',
        description: 'A test NFT for auction end-to-end testing',
        imageUrl: 'https://example.com/test-nft.jpg',
        metadata: {
          attributes: [
            { trait_type: 'Color', value: 'Blue' },
            { trait_type: 'Rarity', value: 'Common' },
          ],
          rarity: 'Common',
          collection: 'Test Collection',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/nfts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createNftDto)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.title).toBe(createNftDto.title);
      expect(response.body.status).toBe(NFTStatus.DRAFT);

      nftId = response.body._id;
    });

    it('/nfts/:id (GET) - should retrieve the created NFT', async () => {
      const response = await request(app.getHttpServer())
        .get(`/nfts/${nftId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body._id).toBe(nftId);
      expect(response.body.title).toBe('Test NFT for Auction');
    });

    it('/nfts/:id/status (PATCH) - should update NFT status to ACTIVE', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/nfts/${nftId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: NFTStatus.ACTIVE })
        .expect(200);

      expect(response.body.status).toBe(NFTStatus.ACTIVE);
    });
  });

  describe('Auction Creation and Management', () => {
    it('/auctions (POST) - should create a new auction', async () => {
      const now = new Date();
      const whitelistStart = new Date(now.getTime() + 60000); // 1 minute from now
      const whitelistEnd = new Date(now.getTime() + 300000); // 5 minutes from now
      const auctionStart = new Date(now.getTime() + 360000); // 6 minutes from now
      const auctionEnd = new Date(now.getTime() + 1800000); // 30 minutes from now

      const createAuctionDto = {
        nftId,
        title: 'Test Auction E2E',
        description: 'End-to-end test auction',
        startingPrice: 100,
        whitelistConfig: {
          maxParticipants: 10,
          entryFee: 25,
          startTime: whitelistStart.toISOString(),
          endTime: whitelistEnd.toISOString(),
        },
        auctionConfig: {
          startTime: auctionStart.toISOString(),
          endTime: auctionEnd.toISOString(),
          minBidIncrement: 10,
          reservePrice: 150,
          buyNowPrice: 500,
        },
      };

      const response = await request(app.getHttpServer())
        .post('/auctions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createAuctionDto)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.title).toBe(createAuctionDto.title);
      expect(response.body.status).toBe(AuctionStatus.DRAFT);
      expect(response.body.startingPrice).toBe(100);

      auctionId = response.body._id;
    });

    it('/auctions (GET) - should retrieve list of auctions', async () => {
      const response = await request(app.getHttpServer())
        .get('/auctions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('_id');
    });

    it('/auctions/:id (GET) - should retrieve the created auction', async () => {
      const response = await request(app.getHttpServer())
        .get(`/auctions/${auctionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body._id).toBe(auctionId);
      expect(response.body.title).toBe('Test Auction E2E');
      expect(response.body.nftId).toBe(nftId);
    });
  });

  describe('Auction Lifecycle Management', () => {
    it('/auctions/:id/lifecycle (GET) - should get lifecycle status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/auctions/${auctionId}/lifecycle`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('currentStatus');
      expect(response.body).toHaveProperty('timeline');
      expect(response.body.currentStatus).toBe(AuctionStatus.DRAFT);
      expect(Array.isArray(response.body.timeline)).toBe(true);
    });

    it('/auctions/:id/lifecycle/trigger (POST) - should trigger state transition', async () => {
      const response = await request(app.getHttpServer())
        .post(`/auctions/${auctionId}/lifecycle/trigger`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('/auctions/lifecycle/status (GET) - should get processing status', async () => {
      const response = await request(app.getHttpServer())
        .get('/auctions/lifecycle/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('isRunning');
      expect(response.body).toHaveProperty('processingInterval');
      expect(response.body.isRunning).toBe(true);
    });
  });

  describe('Whitelist Management', () => {
    it('/auctions/:id/whitelist/join (POST) - should join auction whitelist', async () => {
      // Note: This test assumes the user has sufficient HASH balance
      const response = await request(app.getHttpServer())
        .post(`/auctions/${auctionId}/whitelist/join`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.auctionId).toBe(auctionId);
      expect(response.body.status).toBe('confirmed');
    });

    it('/auctions/:id/whitelist/status (GET) - should check whitelist status', async () => {
      const response = await request(app.getHttpServer())
        .get(`/auctions/${auctionId}/whitelist/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('isWhitelisted');
      expect(response.body.isWhitelisted).toBe(true);
    });

    it('/auctions/:id/whitelist (GET) - should get whitelist participants', async () => {
      const response = await request(app.getHttpServer())
        .get(`/auctions/${auctionId}/whitelist`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('Bidding System', () => {
    it('/auctions/:id/bids (POST) - should place a bid', async () => {
      const placeBidDto = {
        amount: 120,
        bidType: BidType.REGULAR,
        metadata: {
          source: 'e2e-test',
          userAgent: 'test-agent',
        },
      };

      const response = await request(app.getHttpServer())
        .post(`/auctions/${auctionId}/bids`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(placeBidDto)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.amount).toBe(120);
      expect(response.body.bidType).toBe(BidType.REGULAR);
      expect(response.body.status).toBe('confirmed');
    });

    it('/auctions/:id/bids (GET) - should get bid history', async () => {
      const response = await request(app.getHttpServer())
        .get(`/auctions/${auctionId}/bids`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('amount');
    });

    it('/auctions/:id/bids/my-bids (GET) - should get user bids', async () => {
      const response = await request(app.getHttpServer())
        .get(`/auctions/${auctionId}/bids/my-bids`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('/auctions/:id/bids (POST) - should place a higher bid', async () => {
      const placeBidDto = {
        amount: 150,
        bidType: BidType.REGULAR,
        metadata: {
          source: 'e2e-test-higher',
        },
      };

      const response = await request(app.getHttpServer())
        .post(`/auctions/${auctionId}/bids`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(placeBidDto)
        .expect(201);

      expect(response.body.amount).toBe(150);
    });
  });

  describe('Queue System', () => {
    it('/queue/health (GET) - should get queue health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/queue/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('isHealthy');
      expect(response.body).toHaveProperty('metrics');
    });

    it('/queue/metrics (GET) - should get queue metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/queue/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('active');
      expect(response.body).toHaveProperty('waiting');
      expect(response.body).toHaveProperty('completed');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent auction', async () => {
      const fakeId = new Types.ObjectId().toString();
      await request(app.getHttpServer())
        .get(`/auctions/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 400 for invalid bid amount', async () => {
      const placeBidDto = {
        amount: 50, // Less than current highest bid
        bidType: BidType.REGULAR,
        metadata: {},
      };

      await request(app.getHttpServer())
        .post(`/auctions/${auctionId}/bids`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(placeBidDto)
        .expect(400);
    });

    it('should return 401 for unauthorized requests', async () => {
      await request(app.getHttpServer())
        .get(`/auctions/${auctionId}`)
        .expect(401);
    });
  });

  describe('Data Validation', () => {
    it('should validate auction creation data', async () => {
      const invalidAuctionDto = {
        // Missing required fields
        title: 'Invalid Auction',
      };

      await request(app.getHttpServer())
        .post('/auctions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidAuctionDto)
        .expect(400);
    });

    it('should validate bid data', async () => {
      const invalidBidDto = {
        amount: 'invalid-amount', // Should be number
        bidType: 'invalid-type',
      };

      await request(app.getHttpServer())
        .post(`/auctions/${auctionId}/bids`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidBidDto)
        .expect(400);
    });
  });

  describe('Auction Completion Flow', () => {
    it('should complete auction lifecycle', async () => {
      // This test would simulate time passing to complete the auction
      // In a real test, you might manipulate system time or use shorter durations

      // Get final auction state
      const response = await request(app.getHttpServer())
        .get(`/auctions/${auctionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('currentHighestBid');
      expect(response.body.currentHighestBid).toBeGreaterThan(0);
    });
  });
});
