# Auction System Seeder

This directory contains the seeder for the auction system, which populates the database with realistic test data for development and testing purposes.

## Overview

The `AuctionSeeder` creates comprehensive test data including:

- **Operators**: 20 test users with realistic profiles, balances, and metadata
- **NFTs**: 10 unique NFTs with detailed metadata and various rarity levels
- **Auctions**: Multiple auctions in different states (draft, whitelist open, active, ended)
- **Whitelist Entries**: Realistic whitelist participation data
- **Bids**: Bidding history for active and ended auctions
- **Auction History**: Complete event timeline for all auction activities

## Features

### Generated Data

#### NFTs
- 10 unique NFTs with fantasy themes (dragons, guardians, warriors, etc.)
- Detailed metadata with attributes like power level, rarity, element type
- Various rarity levels: Common, Rare, Epic, Legendary
- Realistic image URLs and descriptions

#### Operators
- 20 test operators with creative usernames
- Realistic HASH balances (5,000-15,000 current HASH)
- Random asset equity, EFF values, and fuel levels
- Mix of Telegram and wallet profiles
- Referral data and statistics

#### Auctions
- Multiple auction statuses for comprehensive testing:
  - **Draft**: Future auctions not yet started
  - **Whitelist Open**: Currently accepting whitelist entries
  - **Auction Active**: Live auctions with ongoing bidding
  - **Ended**: Completed auctions with winners
- Realistic pricing (100-600 HASH starting prices)
- Proper timing relationships between whitelist and auction phases
- Random reserve prices and optional buy-now prices

#### Bids & Activity
- Realistic bidding patterns with incremental increases
- Mix of regular and buy-now bids
- Proper bid status tracking (confirmed, outbid, winning)
- Metadata including user agents and IP addresses

#### History Tracking
- Complete event timeline for each auction
- Whitelist opened/closed events
- Auction started/ended events
- Individual bid placement records
- Winner determination events

## Usage

### Run Complete Seeding

```bash
# Seed all auction data
npm run seed:auction
```

### Programmatic Usage

```typescript
import { AuctionSeeder } from './auction/seeders/auction.seeder';

// In your NestJS application context
const seeder = app.get(AuctionSeeder);

// Seed everything
await seeder.seedAll();

// Or seed specific components
await seeder.seedOperators();
await seeder.seedNFTs();
await seeder.seedAuctions(nfts, operators);

// Seed auctions with specific status
await seeder.seedAuctionsByStatus(AuctionStatus.AUCTION_ACTIVE, 5);
```

### Clear Data

The seeder automatically clears existing auction data before seeding. To manually clear:

```typescript
await seeder.clearData();
```

## Data Relationships

The seeder maintains proper data relationships:

1. **Operators** are created first (or existing ones are used)
2. **NFTs** are created independently
3. **Auctions** reference both NFTs and operators
4. **Whitelist entries** reference auctions and operators
5. **Bids** reference auctions and operators
6. **History** records reference auctions and operators

## Configuration

### Auction Timing

The seeder creates auctions with realistic timing:

- **Draft auctions**: Start 24+ hours in the future
- **Whitelist open**: Started 2 hours ago, ends in 2 hours
- **Active auctions**: Started 1 hour ago, end in 23 hours
- **Ended auctions**: Ended 1 hour ago

### Quantities

Default quantities (can be modified in the seeder):
- 20 operators
- 10 NFTs
- 10 auctions (mixed statuses)
- 5-30 whitelist entries per auction
- 3-20 bids per active/ended auction
- Complete history for all events

## Testing Scenarios

The seeded data supports testing:

### Auction Lifecycle
- Draft → Whitelist → Active → Ended progression
- Whitelist entry and validation
- Bid placement and validation
- Auction ending and winner determination

### API Endpoints
- Get auctions with various filters
- Auction detail views
- Whitelist operations
- Bid placement
- History retrieval

### Real-time Features
- WebSocket notifications
- Live bid updates
- Status changes

### Edge Cases
- Auctions with no bids
- Auctions with buy-now purchases
- High-activity auctions
- Various participant counts

## Development Notes

### Operator Reuse
The seeder checks for existing operators and reuses them if 20+ exist, preventing duplicate test users.

### Realistic Data
All generated data uses realistic values:
- Proper HASH amounts based on game economics
- Realistic usernames and profiles
- Appropriate timing intervals
- Valid metadata structures

### Performance
The seeder uses batch operations (`insertMany`) for optimal performance when creating large datasets.

## Troubleshooting

### Common Issues

1. **Missing operators**: Ensure the operator module is properly imported
2. **Timing issues**: Check that auction timing configurations are valid
3. **Validation errors**: Verify all schema requirements are met

### Debugging

Enable detailed logging by checking the seeder output:
```bash
npm run seed:auction
```

The seeder provides detailed progress logs for each step of the seeding process. 