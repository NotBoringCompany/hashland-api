# Database Design and Schema Documentation

## Overview

The Auction System utilizes MongoDB as its primary database, designed for scalability, performance, and real-time operations. This document covers the complete database architecture, schema designs, indexing strategies, and operational considerations.

## Database Architecture

### MongoDB Configuration

**Database Name**: `hashland_auction`  
**Connection**: MongoDB Atlas / Self-hosted  
**Replica Set**: 3-node cluster for high availability  
**Read Preference**: Primary Preferred  
**Write Concern**: Majority  

### Collections Overview

| Collection | Purpose | Est. Size | Growth Rate |
|------------|---------|-----------|-------------|
| `auctions` | Core auction data | 10K docs | 50/day |
| `nfts` | NFT metadata and status | 100K docs | 200/day |
| `auction_whitelists` | Whitelist participation | 500K docs | 1K/day |
| `bids` | All bidding records | 2M docs | 10K/day |
| `auction_histories` | Lifecycle tracking | 100K docs | 500/day |
| `operators` | User/operator data | 50K docs | 100/day |
| `bid_queues` | Queue processing data | 50K docs | 5K/day |

## Core Schemas

### Auctions Collection

```javascript
{
  _id: ObjectId,                    // Primary key
  nft: ObjectId,                  // Reference to NFTs collection
  title: String,                    // Auction title
  description: String,              // Auction description
  startingPrice: Number,            // Starting bid amount
  currentHighestBid: Number,        // Current highest bid
  currentWinner: ObjectId,          // Current winning bidder
  status: String,                   // Enum: draft, whitelist_open, whitelist_closed, auction_active, ended
  
  // Whitelist Configuration
  whitelistConfig: {
    maxParticipants: Number,        // Maximum whitelist spots
    entryFee: Number,              // HASH fee to join whitelist
    startTime: Date,               // Whitelist opening time
    endTime: Date,                 // Whitelist closing time
    isActive: Boolean              // Current whitelist status
  },
  
  // Auction Configuration
  auctionConfig: {
    startTime: Date,               // Auction start time
    endTime: Date,                 // Auction end time
    minBidIncrement: Number,       // Minimum bid increment
    reservePrice: Number,          // Reserve price (optional)
    buyNowPrice: Number            // Buy now price (optional)
  },
  
  // Statistics
  totalBids: Number,               // Total number of bids
  totalParticipants: Number,       // Unique bidders count
  
  // Metadata
  createdAt: Date,
  updatedAt: Date,
  
  // Populated fields (virtual)
  nftDetails: Object,             // Populated NFT data
  winnerDetails: Object,          // Populated winner data
  recentBids: Array               // Recent bid history
}
```

**Indexes**:
```javascript
{ status: 1, "auctionConfig.startTime": 1 }
{ status: 1, "auctionConfig.endTime": 1 }
{ nft: 1 }
{ status: 1, createdAt: -1 }
{ "whitelistConfig.startTime": 1, "whitelistConfig.endTime": 1 }
```

### Auction Whitelists Collection

```javascript
{
  _id: ObjectId,                    // Primary key
  auction: ObjectId,              // Reference to Auctions collection
  operator: ObjectId,             // Reference to Operators collection
  entryFeePaid: Number,             // Amount paid for whitelist entry
  paymentTransactionId: String,     // Transaction ID for payment
  status: String,                   // Enum: pending, confirmed, cancelled
  joinedAt: Date,                   // When user joined whitelist
  
  // Metadata
  metadata: {
    source: String,                 // How user joined (web, api, etc.)
    ipAddress: String,              // User's IP address
    userAgent: String               // User's browser/client info
  },
  
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
```javascript
{ auction: 1, operator: 1 }, { unique: true }
{ auction: 1, status: 1 }
{ auction: 1, status: 1, joinedAt: 1 }
{ operator: 1, status: 1 }
{ operator: 1, joinedAt: -1 }
```

### Bids Collection

```javascript
{
  _id: ObjectId,                    // Primary key
  auction: ObjectId,              // Reference to Auctions collection
  bidder: ObjectId,               // Reference to Operators collection
  amount: Number,                   // Bid amount in HASH
  bidType: String,                  // Enum: regular, buy_now
  status: String,                   // Enum: pending, confirmed, failed, outbid, winning
  transactionId: String,            // Payment transaction ID
  
  // Processing
  processingData: {
    jobId: String,                  // Queue job ID (if queued)
    priority: Number,               // Processing priority
    attempts: Number,               // Processing attempts
    lastError: String               // Last error message
  },
  
  // Metadata
  metadata: {
    source: String,                 // web, api, websocket
    ipAddress: String,
    userAgent: String,
    note: String,                   // Optional user note
    timestamp: Date                 // Original bid timestamp
  },
  
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
```javascript
{ auction: 1, createdAt: -1 }
{ auction: 1, status: 1 }
{ bidder: 1, createdAt: -1 }
{ auction: 1, bidder: 1 }
{ status: 1, createdAt: 1 }
{ auction: 1, status: 1, amount: -1 }
```

### Auction Histories Collection

```javascript
{
  _id: ObjectId,                    // Primary key
  auction: ObjectId,              // Reference to Auctions collection
  operator: ObjectId,             // Reference to Operators collection
  action: String,                   // Action type (state_change, bid_placed, etc.)
  previousState: String,            // Previous auction state
  newState: String,                 // New auction state
  details: Object,                  // Action-specific details
  
  // Context
  context: {
    triggerType: String,            // manual, automatic, scheduled
    adminId: ObjectId,              // Admin who triggered (if manual)
    reason: String                  // Reason for action
  },
  
  timestamp: Date,                  // When action occurred
  createdAt: Date
}
```

**Indexes**:
```javascript
{ auction: 1, timestamp: 1 }
{ action: 1, timestamp: -1 }
{ operator: 1, timestamp: -1 }
{ auction: 1, action: 1 }
{ auction: 1, action: 1, timestamp: 1 }
```

### NFTs Collection

```javascript
{
  _id: ObjectId,                    // Primary key
  title: String,                    // NFT title
  description: String,              // NFT description
  imageUrl: String,                 // Primary image URL
  
  // Metadata
  metadata: {
    attributes: Array,              // NFT attributes/traits
    rarity: String,                 // Rarity level
    collection: String,             // Collection name
    creator: String,                // Creator information
    blockchain: {
      network: String,              // Blockchain network
      contractAddress: String,      // Smart contract address
      tokenId: String               // Token ID on blockchain
    }
  },
  
  // Status
  status: String,                   // Enum: draft, active, in_auction, sold, cancelled
  
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
```javascript
{ status: 1 }
{ "metadata.collection": 1 }
{ "metadata.rarity": 1 }
{ title: "text", description: "text" }
```

### Operators Collection

```javascript
{
  _id: ObjectId,                    // Primary key
  operator: ObjectId,             // Reference to Operators collection
  username: String,                 // Display username
  email: String,                    // Email address
  
  // HASH Balance
  balance: {
    current: Number,                // Available HASH balance
    hold: Number,                   // HASH on hold for active bids
    total: Number                   // Total balance (current + hold)
  },
  
  // Profile
  profile: {
    avatar: String,                 // Profile image URL
    bio: String,                    // User biography
    verified: Boolean,              // Verification status
    joinedAt: Date                  // Account creation date
  },
  
  // Settings
  settings: {
    notifications: {
      email: Boolean,
      push: Boolean,
      outbid: Boolean,
      auctionEnd: Boolean
    },
    privacy: {
      hideActivity: Boolean,
      publicProfile: Boolean
    }
  },
  
  // Statistics
  stats: {
    totalBids: Number,              // Total bids placed
    auctionsWon: Number,            // Auctions won
    totalSpent: Number,             // Total HASH spent
    avgBidAmount: Number            // Average bid amount
  },
  
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
```javascript
{ username: 1 }, { unique: true }
{ email: 1 }, { unique: true }
{ operator: 1, createdAt: -1 }
{ "profile.verified": 1 }
{ "balance.current": 1 }
{ operator: 1, balanceAfter: 1, createdAt: -1 }
```

### Bid Queues Collection

```javascript
{
  _id: ObjectId,                    // Primary key
  jobId: String,                    // Unique job identifier
  auction: ObjectId,              // Reference to Auctions collection
  bidder: ObjectId,               // Reference to Operators collection
  
  // Job Data
  data: {
    amount: Number,                 // Bid amount
    bidType: String,                // Bid type
    metadata: Object                // Additional metadata
  },
  
  // Queue Status
  status: String,                   // Enum: waiting, active, completed, failed, delayed
  priority: Number,                 // Job priority (higher = more urgent)
  attempts: Number,                 // Processing attempts
  maxAttempts: Number,              // Maximum retry attempts
  
  // Timing
  createdAt: Date,                  // When job was created
  processedAt: Date,                // When processing started
  completedAt: Date,                // When job completed
  failedAt: Date,                   // When job failed (if applicable)
  
  // Results
  result: Object,                   // Job result data
  error: Object                     // Error information (if failed)
}
```

**Indexes**:
```javascript
{ jobId: 1 }, { unique: true }
{ status: 1, priority: -1, createdAt: 1 }
{ auction: 1, status: 1, createdAt: 1 }
{ status: 1, createdAt: 1 }
{ bidder: 1, createdAt: -1 }
```

## Indexing Strategy

### Performance Indexes

**Query-based Indexes**:
1. **Active Auctions**: `{ status: 1, "auctionConfig.endTime": 1 }`
2. **Auction Bids**: `{ auction: 1, createdAt: -1 }`
3. **User History**: `{ operator: 1, createdAt: -1 }`
4. **Whitelist Lookup**: `{ auction: 1, operator: 1 }`

**Compound Indexes for Common Queries**:
```javascript
// Find active auctions ending soon
db.auctions.createIndex({ 
  "status": 1, 
  "auctionConfig.endTime": 1 
});

// Bid history for auction
db.bids.createIndex({ 
  auction: 1, 
  "createdAt": -1 
});

// User bid history
db.bids.createIndex({ 
  "bidder": 1, 
  "createdAt": -1 
});

// Whitelist participants
db.auction_whitelists.createIndex({ 
  "auction": 1, 
  "status": 1, 
  "joinedAt": 1 
});
```

### Text Search Indexes

```javascript
// NFT search
db.nfts.createIndex({
  "title": "text",
  "description": "text",
  "metadata.collection": "text"
});

// Auction search
db.auctions.createIndex({
  "title": "text",
  "description": "text"
});
```

## Query Patterns and Optimization

### Common Query Patterns

**1. Find Active Auctions**:
```javascript
db.auctions.find({
  status: "auction_active",
  "auctionConfig.endTime": { $gt: new Date() }
}).sort({ "auctionConfig.endTime": 1 });
```

**2. Auction with Populated Data**:
```javascript
db.auctions.aggregate([
  { $match: { _id: ObjectId("...") } },
  { $lookup: { 
    from: "nfts", 
    localField: "nft", 
    foreignField: "_id", 
    as: "nft" 
  }},
  { $lookup: { from: "operators", localField: "bidder", foreignField: "_id", as: "bidder" } }
]);
```

**3. Bid History with Bidder Info**:
```javascript
db.bids.aggregate([
  { $match: { auction: ObjectId("...") } },
  { $lookup: { 
    from: "operators", 
    localField: "bidder", 
    foreignField: "_id", 
    as: "bidder" 
  }},
  { $sort: { createdAt: -1 } },
  { $limit: 20 }
]);
```

### Index Maintenance

**Background Index Creation**:
```javascript
db.bids.createIndex({ auction: 1, createdAt: -1 }, { background: true });
```

**Index Usage Monitoring**:
```javascript
db.bids.aggregate([
  { $indexStats: {} }
]);
```

## Data Relationships

### Reference Patterns

**Auction → NFT (One-to-One)**:
- Auction document stores `nft` ObjectId
- Populated via aggregation or secondary query
- NFT status updated when auction starts/ends

**Auction → Bids (One-to-Many)**:
- Bid documents store `auction` ObjectId  
- Indexed for efficient auction bid retrieval
- Real-time updates via change streams

**Auction → Whitelist (One-to-Many)**:
- Whitelist documents store `auction` ObjectId
- Unique compound index prevents duplicate entries
- Status tracking for payment confirmation

### Embedded vs Referenced Data

**Embedded**: Configuration objects, metadata, statistics  
**Referenced**: Users, NFTs, bids, transaction records  
**Hybrid**: Denormalized current winner info in auction document

## Performance Considerations

### Read Optimization

**Read Patterns**:
- 70% auction list/detail queries
- 20% bid history queries  
- 10% user profile/history queries

**Caching Strategy**:
- Active auction data (5-minute TTL)
- NFT metadata (1-hour TTL)
- User profile data (15-minute TTL)

### Write Optimization

**Write Patterns**:
- High-frequency: Bid insertions during active auctions
- Medium-frequency: Auction status updates, whitelist joins
- Low-frequency: Auction creation, user registration

**Sharding Considerations**:
- Shard key: `{ auction: 1, createdAt: 1 }` for bids collection
- Prevents hot-spotting during popular auctions
- Balances write load across shards

### Monitoring and Metrics

**Key Metrics**:
- Query response times (target: <100ms p95)
- Index hit ratio (target: >95%)
- Connection pool utilization
- Replica lag (target: <1s)

**Alerting Thresholds**:
- Slow queries: >500ms
- High connection count: >80% of pool
- Replica lag: >5s
- Disk space: >85% used

## Backup and Recovery

### Backup Strategy

**Automated Backups**:
- Full backup: Daily at 02:00 UTC
- Incremental backup: Every 6 hours
- Point-in-time recovery: 7-day window
- Cross-region replication for disaster recovery

**Backup Verification**:
- Monthly restore tests
- Data integrity checks
- Performance baseline validation

### Disaster Recovery

**RTO (Recovery Time Objective)**: 15 minutes  
**RPO (Recovery Point Objective)**: 1 hour  

**Failover Process**:
1. Promote secondary replica
2. Update application connection strings  
3. Verify data consistency
4. Resume normal operations

## Migration and Maintenance

### Schema Migrations

**Migration Process**:
1. Create migration script with rollback
2. Test on staging environment
3. Schedule maintenance window
4. Execute with monitoring
5. Verify data integrity

**Example Migration (Field Rename)**:
```javascript
// Rename nftId to nft
db.auctions.updateMany(
  { nftId: { $exists: true } },
  { $rename: { "nftId": "nft" } }
);

// Update indexes
db.auctions.dropIndex({ nftId: 1 });
db.auctions.createIndex({ nft: 1 });
```

### Maintenance Tasks

**Weekly**:
- Index usage analysis
- Slow query review
- Cleanup old queue jobs
- Archive completed auctions (older than 6 months)

**Monthly**:
- Full backup verification
- Performance baseline review
- Capacity planning assessment
- Security audit

## Security Considerations

### Access Control

**Database Users**:
- `auction_app`: Read/write access to auction collections
- `auction_readonly`: Read-only access for analytics
- `auction_admin`: Full administrative access

**IP Whitelisting**:
- Application servers only
- VPN access for administrators
- No direct public access

### Data Protection

**Encryption**:
- Encryption at rest: AES-256
- Encryption in transit: TLS 1.3
- Field-level encryption: Sensitive user data

**Audit Logging**:
- All administrative operations
- Schema changes
- User access patterns
- Failed authentication attempts

### Compliance

**Data Retention**:
- Active auction data: Indefinite
- Completed auction data: 7 years
- User activity logs: 2 years
- System logs: 90 days

**GDPR Compliance**:
- User data export functionality
- Right to be forgotten implementation
- Consent tracking and management
- Data minimization practices

---

## Appendix

### Collection Size Estimates

| Collection | Document Size | Documents | Total Size |
|------------|---------------|-----------|------------|
| auctions | 2KB | 10K | 20MB |
| bids | 1KB | 2M | 2GB |
| auction_whitelists | 0.5KB | 500K | 250MB |
| nfts | 5KB | 100K | 500MB |
| operators | 3KB | 50K | 150MB |
| **Total** | | | **~3GB** |

### Index Size Monitoring

```javascript
// Check index sizes
db.stats();
db.bids.totalIndexSize();

// Most used indexes
db.bids.aggregate([{ $indexStats: {} }]);
```

### Performance Benchmarks

**Target Performance**:
- Auction list query: <50ms
- Bid placement: <100ms  
- Whitelist join: <200ms
- Real-time bid updates: <10ms

**Load Testing Results**:
- Concurrent users: 1,000
- Bids per second: 100
- Response time p95: <150ms
- Error rate: <0.1%