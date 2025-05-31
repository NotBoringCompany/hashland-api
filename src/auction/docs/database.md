# Database Schema Documentation

## Overview

The Auction System uses MongoDB with Mongoose ODM for data persistence. This document outlines all database schemas, relationships, indexes, and migration strategies.

**Database**: `hashland_auction`  
**ODM**: Mongoose  
**Collections**: 7 primary collections for auction functionality

## Collections Overview

| Collection | Purpose | Documents (Est.) | Key Relationships |
|------------|---------|------------------|-------------------|
| `nfts` | NFT metadata and status | 10K+ | → `auctions` |
| `auctions` | Auction configurations | 1K+ | → `nfts`, `operators` |
| `auction_whitelists` | Whitelist participants | 50K+ | → `auctions`, `operators` |
| `bids` | Bid history and tracking | 500K+ | → `auctions`, `operators` |
| `auction_history` | Event audit trail | 1M+ | → `auctions`, `operators` |
| `hash_transactions` | Currency transactions | 2M+ | → `operators` |
| `bid_queue` | Queue processing status | 1K+ | → `auctions`, `operators` |

## Schema Definitions

### NFT Schema (`nfts`)

```typescript
{
  _id: ObjectId,
  title: string,                    // NFT display name
  description: string,              // NFT description
  imageUrl: string,                 // Main image URL
  metadata: {
    attributes: [{
      trait_type: string,           // Attribute name
      value: string | number        // Attribute value
    }],
    rarity: string,                 // Rarity level
    collection?: string             // Collection name
  },
  status: 'draft' | 'active' | 'in_auction' | 'sold' | 'cancelled',
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
```javascript
// Compound index for listing active NFTs
{ status: 1, createdAt: -1 }

// Text search index
{ title: "text", description: "text" }

// Collection filtering
{ "metadata.collection": 1, status: 1 }

// Rarity filtering
{ "metadata.rarity": 1, status: 1 }
```

**Business Rules**:
- Title must be unique within collection
- Status transitions: `draft` → `active` → `in_auction` → `sold`
- Cannot delete NFT with active auction
- Image URL must be accessible and valid format

### Auction Schema (`auctions`)

```typescript
{
  _id: ObjectId,
  nftId: ObjectId,                  // Reference to NFTs collection
  title: string,                    // Auction title
  description: string,              // Auction description
  startingPrice: number,            // Starting bid amount (HASH)
  currentHighestBid: number,        // Current highest bid (HASH)
  currentWinner: ObjectId | null,   // Reference to Operators collection
  status: 'draft' | 'whitelist_open' | 'whitelist_closed' | 'auction_active' | 'ended' | 'cancelled',
  
  whitelistConfig: {
    maxParticipants: number,        // Maximum whitelist size
    entryFee: number,              // Entry fee in HASH
    startTime: Date,               // Whitelist open time
    endTime: Date,                 // Whitelist close time
    isActive: boolean              // Current whitelist status
  },
  
  auctionConfig: {
    startTime: Date,               // Auction start time
    endTime: Date,                 // Auction end time
    minBidIncrement: number,       // Minimum bid increment (HASH)
    reservePrice?: number,         // Minimum selling price (HASH)
    buyNowPrice?: number           // Instant buy price (HASH)
  },
  
  totalBids: number,               // Total number of bids
  totalParticipants: number,       // Total unique bidders
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
```javascript
// Primary listing index
{ status: 1, createdAt: -1 }

// NFT relationship
{ nftId: 1 }

// Time-based queries
{ "auctionConfig.endTime": 1, status: 1 }
{ "whitelistConfig.startTime": 1, status: 1 }
{ "whitelistConfig.endTime": 1, status: 1 }

// Winner tracking
{ currentWinner: 1, status: 1 }

// Price range filtering
{ startingPrice: 1, status: 1 }
{ currentHighestBid: 1, status: 1 }

// Compound index for active auctions
{ status: 1, "auctionConfig.endTime": 1 }
```

**Business Rules**:
- NFT can only have one active auction
- Whitelist must close before auction starts
- Auction end time must be after start time
- Reserve price must be ≥ starting price
- Buy now price must be > reserve price

### Auction Whitelist Schema (`auction_whitelists`)

```typescript
{
  _id: ObjectId,
  auctionId: ObjectId,              // Reference to Auctions collection
  operatorId: ObjectId,             // Reference to Operators collection
  entryFeePaid: number,             // Amount paid for entry (HASH)
  paymentTransactionId: string,     // Transaction reference
  status: 'confirmed',              // Always confirmed after payment
  joinedAt: Date,                   // Whitelist join timestamp
  createdAt: Date,
  updatedAt: Date,
  
  // Virtual populated fields (not stored)
  operator?: Operator,              // Populated operator data
  auction?: Auction                 // Populated auction data
}
```

**Indexes**:
```javascript
// Compound unique index - one entry per operator per auction
{ auctionId: 1, operatorId: 1 }, { unique: true }

// Auction participants lookup
{ auctionId: 1, status: 1, joinedAt: 1 }

// Operator auction history
{ operatorId: 1, joinedAt: -1 }

// Payment tracking
{ paymentTransactionId: 1 }

// Status filtering
{ status: 1, joinedAt: -1 }
```

**Business Rules**:
- One entry per operator per auction
- Entry fee must match auction whitelist configuration
- Cannot join after whitelist end time
- Payment must be successful for confirmation

### Bid Schema (`bids`)

```typescript
{
  _id: ObjectId,
  auctionId: ObjectId,              // Reference to Auctions collection
  bidderId: ObjectId,               // Reference to Operators collection
  amount: number,                   // Bid amount (HASH)
  bidType: 'regular' | 'buy_now',   // Bid type
  status: 'pending' | 'confirmed' | 'outbid' | 'winning',
  transactionId: string,            // Payment transaction reference
  metadata: {
    userAgent?: string,             // Client user agent
    ipAddress?: string,             // Client IP address
    source?: string,                // Bid source (web, mobile, api)
    timestamp: Date                 // Bid placement timestamp
  },
  createdAt: Date,
  updatedAt: Date,
  
  // Virtual populated fields (not stored)
  bidder?: Operator,                // Populated bidder data
  auction?: Auction                 // Populated auction data
}
```

**Indexes**:
```javascript
// Auction bid history (most recent first)
{ auctionId: 1, createdAt: -1 }

// Bidder history
{ bidderId: 1, createdAt: -1 }

// Status tracking
{ status: 1, createdAt: -1 }

// Compound index for auction leaderboard
{ auctionId: 1, status: 1, amount: -1 }

// Transaction tracking
{ transactionId: 1 }

// Buy now bids (priority processing)
{ bidType: 1, status: 1, createdAt: 1 }

// High-value bid tracking
{ amount: -1, status: 1, createdAt: -1 }
```

**Business Rules**:
- Bid amount must be > current highest bid + min increment
- Cannot bid on own auction (if applicable)
- Bidder must be whitelisted for auction
- Buy now bids immediately end auction

### Auction History Schema (`auction_history`)

```typescript
{
  _id: ObjectId,
  auctionId: ObjectId,              // Reference to Auctions collection
  operatorId: ObjectId,             // Reference to Operators collection
  action: 'whitelist_opened' | 'whitelist_closed' | 'auction_started' | 
          'whitelist_joined' | 'bid_placed' | 'bid_outbid' | 
          'auction_won' | 'auction_ended',
  details: {
    amount?: number,                // Associated amount (for bids)
    previousAmount?: number,        // Previous amount (for outbids)
    bidId?: ObjectId,              // Reference to bid (for bid actions)
    metadata?: any                  // Additional action-specific data
  },
  timestamp: Date,                  // Action timestamp
  createdAt: Date
}
```

**Indexes**:
```javascript
// Auction timeline
{ auctionId: 1, timestamp: 1 }

// Operator activity
{ operatorId: 1, timestamp: -1 }

// Action type filtering
{ action: 1, timestamp: -1 }

// Compound index for auction events
{ auctionId: 1, action: 1, timestamp: 1 }

// Recent activity
{ timestamp: -1 }
```

**Business Rules**:
- Immutable records (no updates after creation)
- All auction events must be logged
- Timestamp must match actual event time

### Hash Transaction Schema (`hash_transactions`)

```typescript
{
  _id: ObjectId,
  operatorId: ObjectId,             // Reference to Operators collection
  transactionType: 'debit' | 'credit',
  amount: number,                   // Transaction amount (HASH)
  category: 'whitelist_payment' | 'bid_hold' | 'bid_refund' | 
           'auction_win' | 'system_reward' | 'manual_adjustment',
  description: string,              // Human-readable description
  relatedEntityId?: ObjectId,       // Reference to auction, bid, etc.
  relatedEntityType?: 'auction' | 'bid' | 'whitelist',
  balanceBefore: number,            // Balance before transaction
  balanceAfter: number,             // Balance after transaction
  status: 'pending' | 'completed' | 'failed',
  metadata?: any,                   // Additional transaction data
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
```javascript
// Operator transaction history
{ operatorId: 1, createdAt: -1 }

// Status filtering
{ status: 1, createdAt: -1 }

// Transaction type and category
{ transactionType: 1, category: 1, createdAt: -1 }

// Related entity tracking
{ relatedEntityId: 1, relatedEntityType: 1 }

// Amount-based queries
{ amount: -1, createdAt: -1 }

// Balance tracking
{ operatorId: 1, balanceAfter: 1, createdAt: -1 }
```

**Business Rules**:
- All balance changes must have transaction records
- Balance before + amount = balance after (for credits)
- Balance before - amount = balance after (for debits)
- Cannot modify completed transactions

### Bid Queue Schema (`bid_queue`)

```typescript
{
  _id: ObjectId,
  auctionId: ObjectId,              // Reference to Auctions collection
  bidderId: ObjectId,               // Reference to Operators collection
  amount: number,                   // Bid amount (HASH)
  priority: number,                 // Processing priority (1-10)
  status: 'queued' | 'processing' | 'completed' | 'failed',
  attempts: number,                 // Processing attempts
  lastAttempt: Date,                // Last processing attempt
  errorMessage?: string,            // Error details if failed
  metadata?: any,                   // Additional bid data
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
```javascript
// Priority queue processing
{ status: 1, priority: -1, createdAt: 1 }

// Auction queue monitoring
{ auctionId: 1, status: 1, createdAt: 1 }

// Failed job tracking
{ status: 1, attempts: -1, lastAttempt: -1 }

// Bidder queue history
{ bidderId: 1, createdAt: -1 }

// Performance monitoring
{ status: 1, createdAt: -1 }
```

**Business Rules**:
- Higher priority jobs processed first
- Max 3 processing attempts before failure
- Failed jobs moved to dead letter queue
- Completed jobs archived after 7 days

## Relationships

### Entity Relationship Diagram

```
Operators (1) ──→ (N) Hash Transactions
    │
    ├─→ (N) Auction Whitelists ──→ (1) Auctions
    │
    ├─→ (N) Bids ──→ (1) Auctions ──→ (1) NFTs
    │
    ├─→ (N) Auction History ──→ (1) Auctions
    │
    └─→ (N) Bid Queue ──→ (1) Auctions
```

### Referential Integrity

**Cascading Deletes**:
- Deleting Auction → Soft delete related bids, whitelist, history
- Deleting Operator → Anonymize related records (keep data integrity)
- Deleting NFT → Prevent if active auction exists

**Foreign Key Constraints** (Application Level):
```typescript
// Mongoose population and validation
auctionId: {
  type: Schema.Types.ObjectId,
  ref: 'Auction',
  required: true,
  validate: {
    validator: async function(v) {
      const auction = await Auction.findById(v);
      return auction !== null;
    },
    message: 'Auction does not exist'
  }
}
```

## Performance Optimization

### Index Strategy

**Query Patterns Analysis**:
1. **List Auctions**: `{ status: 1, createdAt: -1 }`
2. **Auction Bids**: `{ auctionId: 1, createdAt: -1 }`
3. **User History**: `{ operatorId: 1, createdAt: -1 }`
4. **Active Auctions**: `{ status: 1, "auctionConfig.endTime": 1 }`

**Index Maintenance**:
```javascript
// Monitor index usage
db.auctions.aggregate([
  { $indexStats: {} }
]);

// Check query performance
db.auctions.find({ status: "active" }).explain("executionStats");
```

### Collection Sharding Strategy

For high-volume collections:

```javascript
// Shard key for bids collection
sh.shardCollection("hashland_auction.bids", { "auctionId": 1, "_id": 1 });

// Shard key for auction_history
sh.shardCollection("hashland_auction.auction_history", { "auctionId": 1, "timestamp": 1 });

// Shard key for hash_transactions  
sh.shardCollection("hashland_auction.hash_transactions", { "operatorId": 1, "createdAt": 1 });
```

## Data Migration

### Migration Scripts

**Version 1.0 → 1.1: Add Lifecycle Status**

```javascript
// Add new enum values to auction status
db.auctions.updateMany(
  { status: "whitelist_active" },
  { $set: { status: "whitelist_open" } }
);

// Create new index for lifecycle queries
db.auctions.createIndex({ 
  status: 1, 
  "whitelistConfig.endTime": 1, 
  "auctionConfig.startTime": 1 
});
```

**Version 1.1 → 1.2: Add Bid Metadata**

```javascript
// Add metadata field to existing bids
db.bids.updateMany(
  { metadata: { $exists: false } },
  { 
    $set: { 
      metadata: {
        timestamp: "$createdAt",
        source: "legacy"
      }
    }
  }
);
```

### Backup Strategy

**Daily Backups**:
```bash
# Full database backup
mongodump --db hashland_auction --out /backup/daily/$(date +%Y%m%d)

# Collection-specific backup
mongodump --db hashland_auction --collection auctions --out /backup/auctions/
```

**Point-in-Time Recovery**:
```bash
# Enable oplog for replica set
mongod --replSet rs0 --oplogSize 1024

# Restore to specific timestamp
mongorestore --oplogReplay --oplogLimit 1640995200:1 /backup/restore/
```

## Data Validation

### Mongoose Validators

```typescript
// Custom validator for auction timing
auctionConfig: {
  startTime: {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        return v > this.whitelistConfig.endTime;
      },
      message: 'Auction start must be after whitelist end'
    }
  }
}

// Price validation
amount: {
  type: Number,
  required: true,
  min: [1, 'Bid amount must be positive'],
  validate: {
    validator: async function(v) {
      const auction = await Auction.findById(this.auctionId);
      return v >= auction.currentHighestBid + auction.auctionConfig.minBidIncrement;
    },
    message: 'Bid amount too low'
  }
}
```

### Data Integrity Checks

```javascript
// Daily data integrity check
async function validateDataIntegrity() {
  // Check orphaned bids
  const orphanedBids = await Bid.aggregate([
    {
      $lookup: {
        from: 'auctions',
        localField: 'auctionId',
        foreignField: '_id',
        as: 'auction'
      }
    },
    { $match: { auction: { $size: 0 } } }
  ]);

  // Check balance consistency
  const operators = await Operator.find({});
  for (const operator of operators) {
    const calculatedBalance = await HashTransaction.aggregate([
      { $match: { operatorId: operator._id, status: 'completed' } },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $cond: [
                { $eq: ['$transactionType', 'credit'] },
                '$amount',
                { $multiply: ['$amount', -1] }
              ]
            }
          }
        }
      }
    ]);
    
    if (calculatedBalance[0]?.total !== operator.currentHASH) {
      console.warn(`Balance mismatch for operator ${operator._id}`);
    }
  }
}
```

## Monitoring and Metrics

### Performance Metrics

```javascript
// Query performance monitoring
db.setProfilingLevel(2, { slowms: 100 });

// Index utilization
db.runCommand({ collStats: "auctions", indexDetails: true });

// Collection statistics
db.auctions.stats();
```

### Alerting Rules

**Slow Queries**:
- Queries > 100ms trigger warning
- Queries > 1000ms trigger alert

**Collection Growth**:
- Bids collection > 1M documents/day
- Hash transactions > 100K/hour

**Index Issues**:
- Collection scans detected
- Index hit ratio < 95%

## Backup and Recovery

### Automated Backups

```bash
#!/bin/bash
# Daily backup script
DATE=$(date +%Y%m%d)
BACKUP_DIR="/backup/mongodb/$DATE"

# Create backup
mongodump --db hashland_auction --out $BACKUP_DIR

# Compress backup
tar -czf "$BACKUP_DIR.tar.gz" -C /backup/mongodb $DATE

# Upload to cloud storage
aws s3 cp "$BACKUP_DIR.tar.gz" s3://backup-bucket/mongodb/

# Cleanup local files older than 7 days
find /backup/mongodb -name "*.tar.gz" -mtime +7 -delete
```

### Recovery Procedures

**Full Database Recovery**:
```bash
# Download backup
aws s3 cp s3://backup-bucket/mongodb/20231201.tar.gz .

# Extract backup
tar -xzf 20231201.tar.gz

# Restore database
mongorestore --db hashland_auction --drop 20231201/hashland_auction/
```

**Collection-Level Recovery**:
```bash
# Restore specific collection
mongorestore --db hashland_auction --collection auctions 20231201/hashland_auction/auctions.bson
```

## Security Considerations

### Data Encryption

**Encryption at Rest**:
```javascript
// MongoDB encryption configuration
security:
  enableEncryption: true
  encryptionKeyFile: /etc/mongodb-keyfile
```

**Field-Level Encryption**:
```javascript
// Sensitive field encryption
metadata: {
  type: Map,
  of: String,
  encrypt: true  // Mongoose encryption plugin
}
```

### Access Control

**Role-Based Access**:
```javascript
// Create application user
db.createUser({
  user: "auction_app",
  pwd: "secure_password",
  roles: [
    { role: "readWrite", db: "hashland_auction" }
  ]
});

// Create read-only analytics user
db.createUser({
  user: "analytics_user", 
  pwd: "analytics_password",
  roles: [
    { role: "read", db: "hashland_auction" }
  ]
});
```

### Audit Logging

```javascript
// Enable audit logging
auditLog:
  destination: file
  format: JSON
  path: /var/log/mongodb/audit.json
  filter: {
    atype: "authCheck",
    "param.command": { $in: ["find", "insert", "update", "delete"] }
  }
``` 