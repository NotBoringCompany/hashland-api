# Auction System Testing Documentation

## Overview

This document provides comprehensive testing guidelines for the Auction System, covering unit tests, integration tests, WebSocket testing, and end-to-end testing.

## Testing Strategy

### 1. Unit Tests
**Purpose**: Test individual components in isolation

**Components Covered**:
- Services (AuctionService, NFTService, BidQueueService, AuctionLifecycleService)
- Controllers (AuctionController, NFTController, LifecycleController)
- Gateways (AuctionGateway)
- Utilities and helpers

**Example**:
```typescript
describe('AuctionService', () => {
  let service: AuctionService;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuctionService,
        // Mock dependencies
      ],
    }).compile();
    
    service = module.get<AuctionService>(AuctionService);
  });
  
  it('should create auction successfully', async () => {
    // Test implementation
  });
});
```

### 2. Integration Tests
**Purpose**: Test module integration and dependency injection

**Areas Covered**:
- Module compilation and dependency resolution
- Database schema validation
- Service integration with external modules
- Queue and WebSocket integration

**Example**:
```typescript
describe('AuctionModule Integration', () => {
  let module: TestingModule;
  
  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot('mongodb://localhost:27017/test'),
        AuctionModule,
      ],
    }).compile();
  });
  
  it('should compile module successfully', () => {
    expect(module).toBeDefined();
  });
});
```

### 3. API Integration Tests
**Purpose**: Test REST API endpoints

**Coverage**:
- Auction CRUD operations
- Bidding system
- Whitelist management
- Queue operations
- Lifecycle management

**Example**:
```typescript
describe('Auction API', () => {
  let app: INestApplication;
  
  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    app = moduleFixture.createNestApplication();
    await app.init();
  });
  
  it('/auctions (POST)', () => {
    return request(app.getHttpServer())
      .post('/auctions')
      .send(createAuctionDto)
      .expect(201);
  });
});
```

### 4. WebSocket Testing
**Purpose**: Test real-time auction functionality

**Coverage**:
- Connection handling and authentication
- Auction room management
- Real-time bidding
- Notification broadcasting
- Rate limiting

**Example**:
```typescript
describe('AuctionGateway', () => {
  let gateway: AuctionGateway;
  let client: Socket;
  
  beforeEach(async () => {
    // Setup gateway and client
  });
  
  it('should handle bid placement', (done) => {
    client.emit('place_bid', bidData);
    client.on('bid_placed', (response) => {
      expect(response.success).toBe(true);
      done();
    });
  });
});
```

### 5. Queue System Testing
**Purpose**: Test high-frequency bid processing

**Coverage**:
- Job queue operations
- Priority handling
- Retry logic
- Error handling
- Performance metrics

**Example**:
```typescript
describe('BidQueueService', () => {
  let service: BidQueueService;
  
  it('should process bid queue with correct priority', async () => {
    const job = await service.addBidToQueue(auctionId, bidderId, bidData);
    expect(job.opts.priority).toBeDefined();
  });
});
```

### 6. End-to-End Testing
**Purpose**: Test complete auction workflows

**Scenarios**:
- Complete auction lifecycle (creation → bidding → completion)
- Whitelist registration and management
- Currency transactions
- Real-time notifications
- Error handling and edge cases

## Test Configuration

### Jest Configuration
```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "collectCoverageFrom": [
    "**/*.(t|j)s"
  ],
  "coverageDirectory": "../coverage",
  "testEnvironment": "node"
}
```

### Environment Setup
```typescript
// Test environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.REDIS_QUEUE_HOST = 'localhost';
process.env.REDIS_QUEUE_PORT = '6379';
process.env.JWT_SECRET = 'test-secret';
```

## Test Data Management

### Mock Data
```typescript
const mockAuction = {
  _id: new ObjectId(),
  title: 'Test Auction',
  status: AuctionStatus.DRAFT,
  startingPrice: 100,
  // ... other fields
};

const mockBid = {
  _id: new ObjectId(),
  auctionId: mockAuction._id,
  amount: 150,
  bidType: BidType.REGULAR,
  // ... other fields
};
```

### Test Database
- Use MongoDB Memory Server for isolated testing
- Separate test database for integration tests
- Cleanup between test runs

### Test Users and Authentication
```typescript
const createTestUser = async () => {
  const user = await operatorService.create({
    username: 'testuser',
    currentHASH: 10000,
    // ... other fields
  });
  
  const token = jwtService.sign({ sub: user._id });
  return { user, token };
};
```

## Performance Testing

### Load Testing
```typescript
describe('Queue Performance', () => {
  it('should handle 1000 concurrent bids', async () => {
    const promises = Array(1000).fill(null).map(() => 
      service.addBidToQueue(auctionId, bidderId, bidData)
    );
    
    const results = await Promise.all(promises);
    expect(results.every(r => r.success)).toBe(true);
  });
});
```

### Memory and Resource Testing
- Monitor memory usage during tests
- Check for memory leaks
- Verify proper cleanup of resources

## Test Coverage Goals

### Minimum Coverage Requirements
- **Services**: 90%+ line coverage
- **Controllers**: 85%+ line coverage
- **Critical Paths**: 100% coverage
- **Error Handling**: 100% coverage

### Coverage Reports
```bash
# Generate coverage report
yarn test:cov

# View HTML coverage report
open coverage/lcov-report/index.html
```

## Continuous Integration

### Test Pipeline
1. **Unit Tests**: Run on every commit
2. **Integration Tests**: Run on pull requests
3. **E2E Tests**: Run on main branch
4. **Performance Tests**: Run nightly

### Test Commands
```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with coverage
yarn test:cov

# Run E2E tests
yarn test:e2e

# Run specific test file
yarn test auction.service.spec.ts
```

## Debugging Tests

### Common Issues
1. **Database Connection**: Ensure test database is available
2. **Authentication**: Mock JWT tokens for protected endpoints
3. **Async Operations**: Use proper async/await patterns
4. **Race Conditions**: Use proper synchronization in tests

### Debug Configuration
```typescript
// Enable debug logging in tests
process.env.LOG_LEVEL = 'debug';

// Increase test timeout for debugging
jest.setTimeout(30000);
```

## Best Practices

### Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### Test Isolation
- Each test should be independent
- Clean up after each test
- Use fresh data for each test

### Mock Strategy
- Mock external dependencies
- Use real objects for internal dependencies
- Verify mock interactions

### Error Testing
- Test both success and failure scenarios
- Verify error messages and codes
- Test edge cases and boundary conditions

## Test Maintenance

### Keeping Tests Updated
- Update tests when API changes
- Refactor tests with code changes
- Remove obsolete tests

### Test Review Process
- Include tests in code reviews
- Verify test quality and coverage
- Ensure tests add value

## Troubleshooting

### Common Test Failures
1. **Database Connection Issues**
   - Check MongoDB is running
   - Verify connection string
   - Clear test database

2. **Authentication Failures**
   - Verify JWT configuration
   - Check token generation
   - Validate user permissions

3. **Race Conditions**
   - Use proper synchronization
   - Avoid shared state
   - Use test-specific data

4. **Memory Issues**
   - Check for memory leaks
   - Verify proper cleanup
   - Monitor resource usage

### Performance Issues
- Profile slow tests
- Optimize database queries
- Use appropriate test timeouts
- Consider parallel test execution

## Conclusion

Comprehensive testing ensures the auction system is reliable, performant, and maintainable. Follow these guidelines to maintain high-quality test coverage and catch issues early in the development process. 