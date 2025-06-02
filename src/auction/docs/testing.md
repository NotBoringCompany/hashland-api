# Testing Documentation

## Overview

This document covers the comprehensive testing strategy for the Auction System, including unit tests, integration tests, end-to-end tests, and performance testing.

## Testing Strategy

### Test Pyramid

```
       E2E Tests (5%)
    Integration Tests (25%)
  Unit Tests (70%)
```

**Test Distribution**:
- **Unit Tests**: Fast, isolated, high coverage
- **Integration Tests**: Service interactions, database operations
- **E2E Tests**: Full user workflows, critical paths

### Testing Stack

**Frameworks & Tools**:
- **Jest**: Unit and integration testing
- **Supertest**: HTTP endpoint testing
- **Test Containers**: Database testing
- **Socket.IO Client**: WebSocket testing
- **Artillery**: Load testing
- **Cypress**: End-to-end testing

## Unit Testing

### Service Testing

**Auction Service Tests**:
```typescript
describe('AuctionService', () => {
  let service: AuctionService;
  let mockAuctionModel: jest.Mocked<Model<Auction>>;
  let mockBidModel: jest.Mocked<Model<Bid>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuctionService,
        {
          provide: getModelToken('Auction'),
          useValue: mockAuctionModel,
        },
        {
          provide: getModelToken('Bid'),
          useValue: mockBidModel,
        },
      ],
    }).compile();

    service = module.get<AuctionService>(AuctionService);
  });

  describe('createAuction', () => {
    it('should create auction with valid data', async () => {
      const nft = new Types.ObjectId();
      const auctionData = {
        nft,
        title: 'Test Auction',
        startingPrice: 100,
      };

      const mockAuction = {
        _id: new Types.ObjectId(),
        ...auctionData,
        status: 'draft',
      };

      mockAuctionModel.create.mockResolvedValueOnce(mockAuction);

      const result = await service.createAuction(auctionData);

      expect(result).toEqual(mockAuction);
      expect(mockAuctionModel.create).toHaveBeenCalledWith(auctionData);
    });

    it('should throw error for invalid NFT', async () => {
      const auctionData = {
        nft: new Types.ObjectId(),
        title: '',
        startingPrice: -100,
      };

      mockAuctionModel.create.mockRejectedValueOnce(
        new Error('Validation failed')
      );

      await expect(service.createAuction(auctionData)).rejects.toThrow(
        'Validation failed'
      );
    });
  });

  describe('placeBid', () => {
    it('should place valid bid', async () => {
      const auctionId = new Types.ObjectId();
      const bidder = new Types.ObjectId();
      const amount = 150;

      const mockAuction = {
        _id: auctionId,
        currentHighestBid: 100,
        status: 'auction_active',
        auctionConfig: { minBidIncrement: 10 },
      };

      const mockBid = {
        _id: new Types.ObjectId(),
        auction: auctionId,
        bidder,
        amount,
        status: 'confirmed',
      };

      mockAuctionModel.findById.mockResolvedValueOnce(mockAuction);
      mockBidModel.create.mockResolvedValueOnce(mockBid);

      const result = await service.placeBid(auctionId, bidder, amount);

      expect(result).toEqual(mockBid);
      expect(mockBidModel.create).toHaveBeenCalledWith({
        auction: auctionId,
        bidder,
        amount,
        bidType: 'regular',
        status: 'confirmed',
      });
    });

    it('should reject bid below minimum', async () => {
      const auctionId = new Types.ObjectId();
      const bidder = new Types.ObjectId();
      const amount = 105; // Below minimum increment

      const mockAuction = {
        _id: auctionId,
        currentHighestBid: 100,
        auctionConfig: { minBidIncrement: 10 },
      };

      mockAuctionModel.findById.mockResolvedValueOnce(mockAuction);

      await expect(
        service.placeBid(auctionId, bidder, amount)
      ).rejects.toThrow('Bid amount too low');
    });
  });
});
```

**Bid Queue Service Tests**:
```typescript
describe('BidQueueService', () => {
  let service: BidQueueService;
  let mockQueue: jest.Mocked<Queue>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BidQueueService,
        {
          provide: 'BidQueue',
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<BidQueueService>(BidQueueService);
  });

  it('should queue bid with correct data', async () => {
    const auctionId = new Types.ObjectId();
    const bidder = new Types.ObjectId();
    const bidData = { amount: 150, bidType: 'regular' };

    const mockJob = {
      id: 'job-123',
      data: { auction: auctionId, bidder, ...bidData },
    };

    mockQueue.add.mockResolvedValueOnce(mockJob as any);

    const job = await service.addBidToQueue(auctionId, bidder, bidData);

    expect(job.id).toBe('job-123');
    expect(mockQueue.add).toHaveBeenCalledWith(
      'process-bid',
      { auction: auctionId, bidder, ...bidData },
      expect.any(Object)
    );
  });
});
```

### Controller Testing

**Auction Controller Tests**:
```typescript
describe('AuctionController', () => {
  let controller: AuctionController;
  let service: jest.Mocked<AuctionService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuctionController],
      providers: [
        {
          provide: AuctionService,
          useValue: {
            createAuction: jest.fn(),
            getAuctions: jest.fn(),
            placeBid: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuctionController>(AuctionController);
    service = module.get(AuctionService);
  });

  describe('POST /auctions', () => {
    it('should create auction', async () => {
      const createDto = {
        nft: new Types.ObjectId(),
        title: 'Test Auction',
        startingPrice: 100,
      };

      const mockAuction = {
        _id: new Types.ObjectId(),
        ...createDto,
        status: 'draft',
      };

      service.createAuction.mockResolvedValueOnce(mockAuction);

      const result = await controller.createAuction(createDto);

      expect(result).toEqual(mockAuction);
      expect(service.createAuction).toHaveBeenCalledWith(createDto);
    });
  });

  describe('POST /auctions/:id/bids', () => {
    it('should place bid', async () => {
      const auctionId = new Types.ObjectId().toString();
      const placeBidDto = {
        bidder: new Types.ObjectId(),
        amount: 150,
        bidType: 'regular' as const,
      };

      const mockBid = {
        _id: new Types.ObjectId(),
        auction: auctionId,
        bidder: placeBidDto.bidder,
        amount: 150,
        status: 'confirmed',
      };

      service.placeBid.mockResolvedValueOnce(mockBid);

      const result = await controller.placeBid(auctionId, placeBidDto);

      expect(result).toEqual(mockBid);
      expect(service.placeBid).toHaveBeenCalledWith(
        new Types.ObjectId(auctionId),
        placeBidDto.bidder,
        placeBidDto.amount,
        placeBidDto.bidType
      );
    });
  });
});
```

## Integration Testing

### Database Integration

**Auction Repository Tests**:
```typescript
describe('Auction Repository Integration', () => {
  let app: INestApplication;
  let auctionService: AuctionService;
  let mongoConnection: Connection;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(process.env.MONGODB_TEST_URI),
        AuctionModule,
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    auctionService = module.get<AuctionService>(AuctionService);
    mongoConnection = module.get<Connection>(getConnectionToken());
  });

  afterAll(async () => {
    await mongoConnection.close();
    await app.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await mongoConnection.db.dropDatabase();
  });

  describe('Auction CRUD Operations', () => {
    it('should create and retrieve auction', async () => {
      const nft = new Types.ObjectId();
      const auctionData = {
        nft,
        title: 'Integration Test Auction',
        description: 'Test auction for integration testing',
        startingPrice: 100,
      };

      // Create auction
      const createdAuction = await auctionService.createAuction(auctionData);
      expect(createdAuction).toBeDefined();
      expect(createdAuction.nft).toEqual(nft);

      // Retrieve auction
      const retrievedAuction = await auctionService.getAuctionById(
        createdAuction._id
      );
      expect(retrievedAuction).toBeDefined();
      expect(retrievedAuction.title).toBe(auctionData.title);
    });

    it('should handle bid placement', async () => {
      // Create auction first
      const auction = await auctionService.createAuction({
        nft: new Types.ObjectId(),
        title: 'Bid Test Auction',
        startingPrice: 100,
      });

      // Update status to allow bidding
      await auctionService.updateAuctionStatus(auction._id, 'auction_active');

      // Place bid
      const bidder = new Types.ObjectId();
      const bid = await auctionService.placeBid(
        auction._id,
        bidder,
        150,
        'regular'
      );

      expect(bid).toBeDefined();
      expect(bid.auction).toEqual(auction._id);
      expect(bid.bidder).toEqual(bidder);
      expect(bid.amount).toBe(150);

      // Verify auction updated
      const updatedAuction = await auctionService.getAuctionById(auction._id);
      expect(updatedAuction.currentHighestBid).toBe(150);
    });
  });
});
```

### API Integration Testing

**HTTP Endpoint Tests**:
```typescript
describe('Auction API Integration', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    // Get auth token for testing
    authToken = await getTestAuthToken();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/auctions (POST)', () => {
    it('should create auction with valid data', () => {
      return request(app.getHttpServer())
        .post('/auctions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          nft: new Types.ObjectId(),
          title: 'API Test Auction',
          startingPrice: 100,
          whitelistConfig: {
            maxParticipants: 50,
            entryFee: 25,
          },
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.title).toBe('API Test Auction');
          expect(res.body.status).toBe('draft');
        });
    });

    it('should reject invalid auction data', () => {
      return request(app.getHttpServer())
        .post('/auctions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '', // Invalid empty title
          startingPrice: -100, // Invalid negative price
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('validation');
        });
    });
  });

  describe('/auctions/:id/bids (POST)', () => {
    let auctionId: string;

    beforeEach(async () => {
      // Create test auction
      const response = await request(app.getHttpServer())
        .post('/auctions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          nft: new Types.ObjectId(),
          title: 'Bid Test Auction',
          startingPrice: 100,
        });

      auctionId = response.body._id;

      // Activate auction for bidding
      await request(app.getHttpServer())
        .patch(`/auctions/${auctionId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'auction_active' });
    });

    it('should place valid bid', () => {
      return request(app.getHttpServer())
        .post(`/auctions/${auctionId}/bids`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bidder: new Types.ObjectId(),
          amount: 150,
          bidType: 'regular',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.amount).toBe(150);
          expect(res.body.status).toBe('confirmed');
        });
    });

    it('should reject bid below minimum', () => {
      return request(app.getHttpServer())
        .post(`/auctions/${auctionId}/bids`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bidder: new Types.ObjectId(),
          amount: 105, // Below minimum increment
          bidType: 'regular',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('too low');
        });
    });
  });
});
```

## End-to-End Testing

### Cypress E2E Tests

**Auction Workflow Tests**:
```typescript
describe('Auction Workflow', () => {
  beforeEach(() => {
    cy.login('testuser@example.com', 'password');
    cy.visit('/auctions');
  });

  it('should complete full auction participation flow', () => {
    // Find active auction
    cy.get('[data-cy=auction-card]').first().click();

    // Join whitelist
    cy.get('[data-cy=join-whitelist-btn]').click();
    cy.get('[data-cy=confirm-payment-btn]').click();
    cy.get('[data-cy=whitelist-success]').should('be.visible');

    // Wait for auction to start (or manually trigger for testing)
    cy.get('[data-cy=auction-status]').should('contain', 'Active');

    // Place bid
    cy.get('[data-cy=bid-amount-input]').type('150');
    cy.get('[data-cy=place-bid-btn]').click();
    cy.get('[data-cy=bid-success]').should('be.visible');

    // Verify bid appears in history
    cy.get('[data-cy=bid-history]').should('contain', '150');
    cy.get('[data-cy=current-winner]').should('contain', 'You');
  });

  it('should handle outbid scenario', () => {
    cy.visit('/auctions/active-auction-id');

    // Place initial bid
    cy.get('[data-cy=bid-amount-input]').type('150');
    cy.get('[data-cy=place-bid-btn]').click();

    // Simulate another user placing higher bid
    cy.mockWebSocketEvent('new_bid', {
      bid: {
        bidder: { username: 'otheruser' },
        amount: 175,
      },
      auction: {
        currentHighestBid: 175,
      },
    });

    // Verify outbid notification
    cy.get('[data-cy=outbid-notification]').should('be.visible');
    cy.get('[data-cy=current-winner]').should('not.contain', 'You');
  });
});
```

**WebSocket E2E Tests**:
```typescript
describe('Real-time Features', () => {
  it('should receive real-time bid updates', () => {
    cy.login('testuser@example.com', 'password');
    cy.visit('/auctions/test-auction-id');

    // Connect to WebSocket
    cy.connectWebSocket();

    // Join auction room
    cy.get('[data-cy=join-auction-btn]').click();

    // Simulate bid from another user
    cy.mockWebSocketEvent('new_bid', {
      bid: {
        bidder: { username: 'competitor' },
        amount: 200,
      },
      auction: {
        currentHighestBid: 200,
        totalBids: 5,
      },
    });

    // Verify UI updates
    cy.get('[data-cy=current-highest-bid]').should('contain', '200');
    cy.get('[data-cy=total-bids]').should('contain', '5');
    cy.get('[data-cy=bid-history]').should('contain', 'competitor');
  });

  it('should show auction ending warnings', () => {
    cy.login('testuser@example.com', 'password');
    cy.visit('/auctions/ending-auction-id');

    // Mock ending soon event
    cy.mockWebSocketEvent('auction_ending_soon', {
      auctionId: 'ending-auction-id',
      minutesLeft: 5,
    });

    // Verify warning displayed
    cy.get('[data-cy=ending-warning]').should('be.visible');
    cy.get('[data-cy=ending-warning]').should('contain', '5 minutes');
  });
});
```

## Performance Testing

### Load Testing with Artillery

**artillery.yml**:
```yaml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Ramp up"
    - duration: 300
      arrivalRate: 50
      name: "Sustained load"
    - duration: 60
      arrivalRate: 100
      name: "Peak load"
  
  variables:
    testAuctionId: "60f1b2b3b3b3b3b3b3b3b3b4"

scenarios:
  - name: "Get auction list"
    weight: 40
    flow:
      - get:
          url: "/auctions"
          headers:
            Authorization: "Bearer {{ $randomString() }}"

  - name: "Place bid"
    weight: 30
    flow:
      - post:
          url: "/auctions/{{ testAuctionId }}/bids"
          headers:
            Authorization: "Bearer {{ $randomString() }}"
          json:
            bidder: "{{ $randomString() }}"
            amount: "{{ $randomInt(100, 1000) }}"
            bidType: "regular"

  - name: "Join whitelist"
    weight: 20
    flow:
      - post:
          url: "/auctions/{{ testAuctionId }}/whitelist/join"
          headers:
            Authorization: "Bearer {{ $randomString() }}"

  - name: "WebSocket bidding"
    weight: 10
    engine: ws
    flow:
      - connect:
          url: "ws://localhost:3000/auction"
      - send:
          payload: '{"event": "join_auction", "data": {"auctionId": "{{ testAuctionId }}"}}'
      - send:
          payload: '{"event": "place_bid", "data": {"bidder": "{{ $randomString() }}", "amount": {{ $randomInt(100, 1000) }}}}'
```

**Performance Test Script**:
```typescript
describe('Performance Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should handle concurrent bid placement', async () => {
    const auctionId = new Types.ObjectId();
    const bidPromises = [];

    // Create 100 concurrent bid requests
    for (let i = 0; i < 100; i++) {
      const bidPromise = request(app.getHttpServer())
        .post(`/auctions/${auctionId}/bids`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          bidder: new Types.ObjectId(),
          amount: 100 + i,
          bidType: 'regular',
        });

      bidPromises.push(bidPromise);
    }

    const results = await Promise.allSettled(bidPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Successful bids: ${successful}, Failed bids: ${failed}`);
    
    // At least 80% should succeed
    expect(successful / 100).toBeGreaterThan(0.8);
  });

  it('should maintain response time under load', async () => {
    const startTime = Date.now();
    const promises = [];

    // 50 concurrent auction list requests
    for (let i = 0; i < 50; i++) {
      promises.push(
        request(app.getHttpServer())
          .get('/auctions')
          .set('Authorization', `Bearer ${testToken}`)
      );
    }

    await Promise.all(promises);
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Should complete within 5 seconds
    expect(totalTime).toBeLessThan(5000);
  });
});
```

## Test Data Management

### Test Fixtures

**Auction Fixtures**:
```typescript
export const auctionFixtures = {
  draftAuction: {
    nft: new Types.ObjectId(),
    title: 'Draft Auction',
    description: 'Test auction in draft state',
    startingPrice: 100,
    status: 'draft',
  },

  activeAuction: {
    nft: new Types.ObjectId(),
    title: 'Active Auction',
    description: 'Test auction currently active',
    startingPrice: 100,
    currentHighestBid: 150,
    status: 'auction_active',
    auctionConfig: {
      startTime: new Date('2023-01-01T10:00:00Z'),
      endTime: new Date('2023-01-02T10:00:00Z'),
      minBidIncrement: 10,
    },
  },

  endedAuction: {
    nft: new Types.ObjectId(),
    title: 'Ended Auction',
    description: 'Test auction that has ended',
    startingPrice: 100,
    currentHighestBid: 500,
    status: 'ended',
    currentWinner: new Types.ObjectId(),
  },
};

export const bidFixtures = {
  regularBid: {
    auction: new Types.ObjectId(),
    bidder: new Types.ObjectId(),
    amount: 150,
    bidType: 'regular',
    status: 'confirmed',
  },

  buyNowBid: {
    auction: new Types.ObjectId(),
    bidder: new Types.ObjectId(),
    amount: 1000,
    bidType: 'buy_now',
    status: 'confirmed',
  },

  outbidBid: {
    auction: new Types.ObjectId(),
    bidder: new Types.ObjectId(),
    amount: 120,
    bidType: 'regular',
    status: 'outbid',
  },
};
```

### Factory Functions

```typescript
export class TestDataFactory {
  static createAuction(overrides: Partial<any> = {}) {
    return {
      _id: new Types.ObjectId(),
      nft: new Types.ObjectId(),
      title: 'Test Auction',
      description: 'Test auction description',
      startingPrice: 100,
      currentHighestBid: 0,
      status: 'draft',
      totalBids: 0,
      totalParticipants: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createBid(overrides: Partial<any> = {}) {
    return {
      _id: new Types.ObjectId(),
      auction: new Types.ObjectId(),
      bidder: new Types.ObjectId(),
      amount: 150,
      bidType: 'regular',
      status: 'confirmed',
      createdAt: new Date(),
      ...overrides,
    };
  }

  static createUser(overrides: Partial<any> = {}) {
    return {
      _id: new Types.ObjectId(),
      username: 'testuser',
      email: 'test@example.com',
      balance: { current: 1000, hold: 0, total: 1000 },
      createdAt: new Date(),
      ...overrides,
    };
  }
}
```

## Continuous Integration

### GitHub Actions Workflow

**.github/workflows/test.yml**:
```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:5.0
        env:
          MONGO_INITDB_ROOT_USERNAME: root
          MONGO_INITDB_ROOT_PASSWORD: password
        ports:
          - 27017:27017
      
      redis:
        image: redis:6.2
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linting
        run: npm run lint
      
      - name: Run unit tests
        run: npm run test:unit
        env:
          MONGODB_TEST_URI: mongodb://root:password@localhost:27017/test?authSource=admin
          REDIS_TEST_URL: redis://localhost:6379
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          MONGODB_TEST_URI: mongodb://root:password@localhost:27017/test?authSource=admin
          REDIS_TEST_URL: redis://localhost:6379
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          MONGODB_TEST_URI: mongodb://root:password@localhost:27017/test?authSource=admin
          REDIS_TEST_URL: redis://localhost:6379
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

## Test Coverage

### Coverage Requirements

**Coverage Targets**:
- **Overall**: 90%
- **Statements**: 90%
- **Branches**: 85%
- **Functions**: 95%
- **Lines**: 90%

**Jest Configuration**:
```javascript
module.exports = {
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/main.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.dto.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 85,
      functions: 95,
      lines: 90,
    },
    './src/auction/services/': {
      statements: 95,
      branches: 90,
      functions: 100,
      lines: 95,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
};
```

---

## Best Practices

### Test Organization

1. **Descriptive Test Names**: Use clear, behavior-driven descriptions
2. **Test Isolation**: Each test should be independent
3. **Setup/Teardown**: Proper cleanup after each test
4. **Mocking Strategy**: Mock external dependencies, test real business logic

### Performance Testing

1. **Baseline Establishment**: Document current performance metrics
2. **Load Simulation**: Test with realistic user patterns
3. **Bottleneck Identification**: Use profiling to find slow operations
4. **Regression Prevention**: Fail builds if performance degrades

### Quality Gates

1. **Test Coverage**: Minimum 90% coverage required
2. **Performance**: Response times under defined thresholds
3. **Security**: No critical vulnerabilities in dependencies
4. **Code Quality**: Linting and formatting checks pass

For detailed testing examples and utilities, see the [examples/testing](../examples/testing) directory.