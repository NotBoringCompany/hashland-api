# Auction System Module

## Overview

The Auction System module provides a comprehensive NFT auction platform with whitelist functionality, real-time bidding, and high-frequency request handling. The system ensures fair participation through a whitelist mechanism where users must pay using the platform's currency system to join limited-time auctions.

## Key Features

- **Whitelist System**: Limited user participation with payment requirement using platform currency (auto-confirmation)
- **Real-time Bidding**: WebSocket integration for live bid updates
- **High-frequency Support**: Queue-based bid processing for scalability
- **Historical Tracking**: Complete bid history and audit trails
- **Currency Integration**: Integration with existing HASH currency system
- **Time-limited Auctions**: Configurable auction durations with automatic closure

## Database Schema

### NFT Schema (`nfts` collection)
```typescript
{
  _id: ObjectId,
  title: string,
  description: string,
  imageUrl: string,
  metadata: {
    attributes: Array<{
      trait_type: string,
      value: string | number
    }>,
    rarity: string,
    collection?: string
  },
  status: 'draft' | 'active' | 'sold' | 'cancelled',
  createdAt: Date,
  updatedAt: Date
}
```

### Auction Schema (`auctions` collection)
```typescript
{
  _id: ObjectId,
  nftId: ObjectId, // Reference to NFTs
  title: string,
  description: string,
  startingPrice: number, // In HASH currency
  currentHighestBid: number,
  currentWinner: ObjectId | null, // Reference to Operators
  status: 'draft' | 'whitelist_open' | 'auction_active' | 'ended' | 'cancelled',
  whitelistConfig: {
    maxParticipants: number,
    entryFee: number, // In HASH currency
    startTime: Date,
    endTime: Date,
    isActive: boolean
  },
  auctionConfig: {
    startTime: Date,
    endTime: Date,
    minBidIncrement: number,
    reservePrice?: number,
    buyNowPrice?: number
  },
  totalBids: number,
  totalParticipants: number,
  createdAt: Date,
  updatedAt: Date
}
```

### Whitelist Schema (`auction_whitelists` collection)
```typescript
{
  _id: ObjectId,
  auctionId: ObjectId, // Reference to Auctions
  operatorId: ObjectId, // Reference to Operators
  entryFeePaid: number,
  paymentTransactionId: string,
  status: 'confirmed', // Auto-confirmed after payment
  joinedAt: Date,
  createdAt: Date,
  updatedAt: Date,
  
  // Populated fields for quick access
  operator?: Operator, // Populated operator data
  auction?: Auction // Populated auction data
}
```

### Bid Schema (`bids` collection)
```typescript
{
  _id: ObjectId,
  auctionId: ObjectId, // Reference to Auctions
  bidderId: ObjectId, // Reference to Operators
  amount: number, // In HASH currency
  bidType: 'regular' | 'buy_now',
  status: 'pending' | 'confirmed' | 'outbid' | 'winning',
  transactionId: string,
  metadata: {
    userAgent?: string,
    ipAddress?: string,
    timestamp: Date
  },
  createdAt: Date,
  updatedAt: Date,
  
  // Populated fields for quick access
  bidder?: Operator, // Populated bidder data
  auction?: Auction // Populated auction data
}
```

### Bid Queue Schema (`bid_queue` collection)
```typescript
{
  _id: ObjectId,
  auctionId: ObjectId,
  bidderId: ObjectId,
  amount: number,
  priority: number, // For queue ordering
  status: 'queued' | 'processing' | 'completed' | 'failed',
  attempts: number,
  lastAttempt: Date,
  errorMessage?: string,
  createdAt: Date,
  updatedAt: Date
}
```

### Auction History Schema (`auction_history` collection)
```typescript
{
  _id: ObjectId,
  auctionId: ObjectId,
  operatorId: ObjectId,
  action: 'whitelist_joined' | 'bid_placed' | 'bid_outbid' | 'auction_won' | 'auction_ended',
  details: {
    amount?: number,
    previousAmount?: number,
    metadata?: any
  },
  timestamp: Date,
  createdAt: Date
}
```

### Hash Transaction History Schema (`hash_transactions` collection)
```typescript
{
  _id: ObjectId,
  operatorId: ObjectId, // Reference to Operators
  transactionType: 'debit' | 'credit',
  amount: number,
  category: 'whitelist_payment' | 'bid_hold' | 'bid_refund' | 'auction_win' | 'system_reward' | 'manual_adjustment',
  description: string,
  relatedEntityId?: ObjectId, // Reference to auction, bid, etc.
  relatedEntityType?: 'auction' | 'bid' | 'whitelist',
  balanceBefore: number,
  balanceAfter: number,
  status: 'pending' | 'completed' | 'failed',
  metadata?: any,
  createdAt: Date,
  updatedAt: Date
}
```

## Currency System Integration

The system integrates with the existing operator currency system by:

1. **Current HASH Balance**: Adding `currentHASH` field to Operator schema
2. **Hold HASH**: Adding `holdHASH` field for bid amounts held temporarily
3. **Transaction History**: Complete audit trail of all HASH movements
4. **Whitelist Payments**: Auto-deducting entry fees with immediate confirmation
5. **Bid Hold**: Temporarily holding bid amounts
6. **Automated Refunds**: Returning held amounts when outbid

### Required Operator Schema Updates
```typescript
// Add to existing Operator schema
currentHASH: number; // Current available HASH balance
holdHASH: number; // HASH held temporarily for active bids
```

## WebSocket Events

### Client → Server Events
- `join_auction`: Join auction room for real-time updates
- `leave_auction`: Leave auction room
- `place_bid`: Submit a new bid
- `get_auction_status`: Request current auction state

### Server → Client Events
- `auction_updated`: Auction state changes
- `new_bid`: New bid placed notification
- `bid_outbid`: User's bid was outbid
- `auction_ending_soon`: Auction ending warning (5 minutes)
- `auction_ended`: Auction has ended
- `whitelist_status_changed`: Whitelist opening/closing

## Queue System

### Bid Processing Queue
- **High Priority**: Buy-now bids
- **Medium Priority**: Bids in final 5 minutes
- **Low Priority**: Regular bids
- **Retry Logic**: Failed bids retry up to 3 times
- **Dead Letter Queue**: Failed bids after max retries

## API Endpoints Structure

### Auction Management
- `POST /auctions` - Create new auction
- `GET /auctions` - List auctions with filters
- `GET /auctions/:id` - Get auction details
- `PUT /auctions/:id` - Update auction (admin only)
- `DELETE /auctions/:id` - Cancel auction (admin only)

### Whitelist Management
- `POST /auctions/:id/whitelist/join` - Join auction whitelist (auto-confirmed after payment)
- `GET /auctions/:id/whitelist` - Get whitelist participants
- `GET /auctions/:id/whitelist/status` - Check user's whitelist status

### Bidding
- `POST /auctions/:id/bids` - Place a bid
- `GET /auctions/:id/bids` - Get bid history
- `GET /auctions/:id/bids/my-bids` - Get user's bids for auction

### NFT Management
- `POST /nfts` - Create NFT (admin only)
- `GET /nfts` - List NFTs
- `GET /nfts/:id` - Get NFT details
- `PUT /nfts/:id` - Update NFT (admin only)

## TODO List

### Phase 0.5: Currency System Enhancement
- [x] Add `currentHASH` and `holdHASH` fields to Operator schema
- [x] Create `HashTransaction` schema for transaction history
- [x] Implement `deductHASH()` function in OperatorService
- [x] Implement `addHASH()` function in OperatorService
- [x] Implement `holdHASH()` function for bid amounts
- [x] Implement `releaseHold()` function for refunds
- [x] Add transaction history tracking for all HASH movements
- [x] Create validation for sufficient balance checks
- [x] ~~Add atomic transaction handling for currency operations~~ (Removed for database compatibility)

### Phase 1: Core Infrastructure
- [ ] Create database schemas and models
- [ ] Set up basic module structure (controller, service, DTOs)
- [ ] Implement NFT CRUD operations
- [ ] Create auction CRUD operations
- [ ] Add currency system integration
- [ ] Implement basic validation and error handling

### Phase 2: Whitelist System
- [ ] Implement whitelist join functionality with auto-confirmation
- [ ] Add payment processing for whitelist entry
- [ ] Create whitelist status checking
- [ ] Add whitelist time limits and capacity limits
- [ ] Implement whitelist participant management
- [ ] Add populated fields for quick access

### Phase 3: Bidding Core
- [ ] Create bid placement logic
- [ ] Implement bid validation (minimum increment, user balance)
- [ ] Add bid history tracking
- [ ] Create bid status management (outbid notifications)
- [ ] Implement hold system for bid amounts
- [ ] Add populated fields for quick access

### Phase 4: Queue System
- [ ] Set up Redis/Bull queue for bid processing
- [ ] Implement priority-based bid processing
- [ ] Add retry logic for failed bids
- [ ] Create dead letter queue handling
- [ ] Add queue monitoring and metrics

### Phase 5: WebSocket Integration
- [ ] Set up Socket.IO gateway
- [ ] Implement auction room management
- [ ] Add real-time bid notifications
- [ ] Create auction status broadcasting
- [ ] Implement connection management and authentication

### Phase 6: Advanced Features
- [ ] Add auction auto-extension (if bid in last 5 minutes)
- [ ] Implement buy-now functionality
- [ ] Create auction analytics and reporting
- [ ] Add auction search and filtering
- [ ] Implement auction categories and collections

### Phase 7: Performance & Security
- [ ] Add rate limiting for bid placement
- [ ] Implement fraud detection for suspicious bidding
- [ ] Add comprehensive logging and monitoring
- [ ] Create performance optimization for high-frequency requests
- [ ] Add security measures for WebSocket connections

### Phase 8: Testing & Documentation
- [ ] Write unit tests for all services
- [ ] Create integration tests for auction flows
- [ ] Add end-to-end tests for WebSocket functionality
- [ ] Create API documentation with Swagger
- [ ] Add performance testing for queue system

## Dependencies

### Required Packages
- `@nestjs/websockets` - WebSocket support
- `@nestjs/platform-socket.io` - Socket.IO integration
- `socket.io` - Real-time communication
- `@nestjs/bull` - Queue management
- `bull` - Redis-based queue
- `ioredis` - Redis client

### Existing Dependencies
- `@nestjs/mongoose` - MongoDB integration
- `mongoose` - MongoDB ODM
- `@nestjs/swagger` - API documentation
- `class-validator` - DTO validation
- `class-transformer` - Object transformation

## Configuration

### Environment Variables
```env
# Queue Configuration
REDIS_QUEUE_HOST=localhost
REDIS_QUEUE_PORT=6379
REDIS_QUEUE_PASSWORD=

# WebSocket Configuration
WEBSOCKET_CORS_ORIGIN=http://localhost:3000
WEBSOCKET_PORT=3001

# Auction Configuration
DEFAULT_AUCTION_DURATION_HOURS=24
DEFAULT_WHITELIST_DURATION_HOURS=48
MIN_BID_INCREMENT=10
DEFAULT_ENTRY_FEE=100
```

## Security Considerations

1. **Authentication**: All auction operations require authenticated users
2. **Authorization**: Only admins can create/modify auctions and NFTs
3. **Rate Limiting**: Prevent spam bidding with rate limits
4. **Input Validation**: Strict validation on all bid amounts and auction parameters
5. **Hold Security**: Secure handling of held HASH amounts
6. **WebSocket Security**: Authenticated WebSocket connections only

## Performance Considerations

1. **Database Indexing**: Proper indexes on frequently queried fields
2. **Queue Processing**: Efficient queue processing with appropriate concurrency
3. **WebSocket Scaling**: Consider Redis adapter for multi-instance deployments
4. **Caching**: Cache frequently accessed auction data
5. **Connection Pooling**: Optimize database connection usage
6. **Populated Fields**: Use populated fields strategically to reduce database queries
