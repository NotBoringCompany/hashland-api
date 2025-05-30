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

## Implementation Progress

### ✅ Phase 0.5: Currency System Enhancement (COMPLETE)
Enhanced the existing operator currency system to support auction functionality:
- Added `currentHASH` and `holdHASH` fields to Operator schema
- Created comprehensive `HashTransaction` schema for transaction tracking
- Implemented currency management functions in OperatorService:
  - `deductHASH()` - Deduct from current balance with history
  - `addHASH()` - Add to current balance with history  
  - `holdHASH()` - Move from current to hold balance
  - `releaseHold()` - Move from hold back to current balance
  - `getHashTransactionHistory()` - Retrieve paginated transaction history
  - `validateSufficientBalance()` - Check if operator has sufficient funds
- All functions include proper error handling and logging
- Transaction history tracking for all currency operations

### ✅ Phase 1: Core Infrastructure (COMPLETE)
Implemented the foundational database schemas and basic CRUD operations:

**Database Schemas:**
- ✅ NFT schema with metadata, rarity, and status tracking
- ✅ Auction schema with whitelist and auction configurations
- ✅ AuctionWhitelist schema for managing whitelist entries
- ✅ Bid schema with bid types and status tracking
- ✅ AuctionHistory schema for comprehensive event logging
- ✅ Proper indexing for all schemas for optimal performance

**Services:**
- ✅ NFTService with full CRUD operations
- ✅ AuctionService with core auction management functions:
  - Create auctions with validation
  - Join whitelist with payment processing
  - Place bids with hold functionality
  - End auctions with winner processing
  - Get auction history with pagination

**Controllers:**
- ✅ NFTController with REST API endpoints
- ✅ AuctionController with comprehensive auction endpoints
- ✅ Proper Swagger documentation for all endpoints
- ✅ Input validation and error handling

**Module Structure:**
- ✅ AuctionModule with proper dependency injection
- ✅ Integration with existing OperatorModule
- ✅ Export index file for clean imports

### ✅ Phase 2: API Endpoints & Validation (COMPLETE)
Enhanced REST API endpoints with comprehensive validation and error handling:

**Input Validation DTOs:**
- ✅ CreateNFTDto with nested validation for metadata and attributes
- ✅ UpdateNFTDto and UpdateNFTStatusDto for NFT modifications
- ✅ CreateAuctionDto with comprehensive auction and whitelist configuration validation
- ✅ PlaceBidDto with bid amount and metadata validation
- ✅ JoinWhitelistDto for whitelist participation
- ✅ Response DTOs for consistent API documentation

**Validation Features:**
- ✅ Class-validator decorators for all input validation
- ✅ Transform and whitelist options for security
- ✅ MongoDB ObjectId validation
- ✅ Date string validation for auction timing
- ✅ Numeric validation with minimum values
- ✅ Enum validation for status and bid types

**Error Handling:**
- ✅ Custom AuctionExceptionFilter for consistent error responses
- ✅ MongoDB error handling (duplicate keys, validation errors)
- ✅ HTTP exception handling with detailed error messages
- ✅ Validation error formatting with field-specific messages
- ✅ Comprehensive error logging

**API Documentation:**
- ✅ Enhanced Swagger documentation with proper DTOs
- ✅ Request/response examples for all endpoints
- ✅ Error response documentation with status codes
- ✅ Query parameter documentation with types and descriptions
- ✅ Comprehensive API response types

**Controller Enhancements:**
- ✅ ValidationPipe integration with transform and whitelist
- ✅ Proper HTTP status codes for all operations
- ✅ Enhanced error responses with detailed information
- ✅ Type-safe request/response handling

### 🔄 Phase 3: WebSocket Integration (NEXT)
Real-time bidding functionality:
- Socket.IO integration
- Real-time bid updates
- Auction status notifications
- Connection management
- Event broadcasting

### 📋 Phase 4: Queue System
High-frequency request handling:
- Bull queue integration
- Bid processing queue
- Payment processing queue
- Notification queue
- Queue monitoring

### 📋 Phase 5: Business Logic
Advanced auction features:
- Auction lifecycle management
- Automated auction transitions
- Reserve price handling
- Buy-now functionality
- Bid validation rules

### 📋 Phase 6: Testing
Comprehensive test coverage:
- Unit tests for services
- Integration tests for APIs
- WebSocket testing
- Load testing for queues
- End-to-end testing

### 📋 Phase 7: Documentation
Complete system documentation:
- API documentation
- WebSocket event documentation
- Database schema documentation
- Deployment guides
- User guides

### 📋 Phase 8: Deployment & Monitoring
Production readiness:
- Environment configuration
- Logging and monitoring
- Performance optimization
- Security hardening
- Backup strategies

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
