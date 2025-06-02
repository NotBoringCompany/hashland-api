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
- **Automated Lifecycle**: Cron-based state transitions and lifecycle management
- **Comprehensive Testing**: Full test coverage with unit, integration, and E2E tests
- **Complete Documentation**: API, WebSocket, database, deployment, and user guides

## Currency System Integration

The system integrates with the existing operator currency system by:

1. **Current HASH Balance**: Adding `currentHASH` field to Operator schema
2. **Hold HASH**: Adding `holdHASH` field for bid amounts held temporarily
3. **Transaction History**: Complete audit trail of all HASH movements
4. **Whitelist Payments**: Auto-deducting entry fees with immediate confirmation
5. **Bid Hold**: Temporarily holding bid amounts
6. **Automated Refunds**: Returning held amounts when outbid

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

### Lifecycle Management
- `GET /auctions/:id/lifecycle` - Get lifecycle status and timeline
- `POST /auctions/:id/lifecycle/trigger` - Manual state transition (admin)
- `GET /auctions/lifecycle/status` - System processing status

## Dependencies

### Required Packages
- `@nestjs/websockets` - WebSocket support
- `@nestjs/platform-socket.io` - Socket.IO integration
- `socket.io` - Real-time communication
- `@nestjs/bull` - Queue management
- `bull` - Redis-based queue
- `ioredis` - Redis client
- `@nestjs/schedule` - Cron job scheduling

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
LIFECYCLE_CRON_SCHEDULE="0 * * * * *"
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

## Documentation

### Available Documentation
- **API Documentation**: [`docs/api.md`](./docs/api.md) - Complete REST API reference
- **WebSocket Documentation**: [`docs/websocket.md`](./docs/websocket.md) - Real-time events and connection guide
- **Database Documentation**: [`docs/database.md`](./docs/database.md) - Schema definitions, relationships, and optimization
- **Deployment Guide**: [`docs/deployment.md`](./docs/deployment.md) - Production deployment, scaling, and monitoring
- **User Guide**: [`docs/user-guide.md`](./docs/user-guide.md) - End-user guide for auction participation
- **Testing Documentation**: [`docs/testing.md`](./docs/testing.md) - Testing strategies and implementation

### Quick Start

1. **API Reference**: Start with `docs/api.md` for endpoint documentation
2. **Real-time Features**: See `docs/websocket.md` for WebSocket integration
3. **Database Setup**: Check `docs/database.md` for schema and configuration
4. **Production Deployment**: Follow `docs/deployment.md` for production setup
5. **User Training**: Use `docs/user-guide.md` for end-user documentation
