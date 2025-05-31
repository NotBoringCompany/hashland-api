# Auction System API Documentation

## Overview

The Auction System provides a comprehensive RESTful API for managing NFT auctions with whitelist functionality, real-time bidding, and automated lifecycle management.

**Base URL**: `/api/v1`  
**Authentication**: JWT Bearer Token  
**Content-Type**: `application/json`

## Authentication

All API endpoints require authentication via JWT Bearer token:

```http
Authorization: Bearer <your-jwt-token>
```

### Getting a Token

```http
POST /auth/login
Content-Type: application/json

{
  "username": "your-username",
  "password": "your-password"
}
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 86400,
  "user": {
    "id": "60f1b2b3b3b3b3b3b3b3b3b3",
    "username": "your-username"
  }
}
```

## NFT Management

### Create NFT

**Endpoint**: `POST /nfts`  
**Auth**: Required (Admin)

**Request Body**:
```json
{
  "title": "Amazing Digital Art",
  "description": "A unique piece of digital artwork",
  "imageUrl": "https://example.com/nft-image.jpg",
  "metadata": {
    "attributes": [
      {
        "trait_type": "Color",
        "value": "Blue"
      },
      {
        "trait_type": "Rarity",
        "value": "Legendary"
      }
    ],
    "rarity": "Legendary",
    "collection": "Digital Art Collection"
  }
}
```

**Response** `201 Created`:
```json
{
  "_id": "60f1b2b3b3b3b3b3b3b3b3b3",
  "title": "Amazing Digital Art",
  "description": "A unique piece of digital artwork",
  "imageUrl": "https://example.com/nft-image.jpg",
  "metadata": {
    "attributes": [
      {
        "trait_type": "Color",
        "value": "Blue"
      },
      {
        "trait_type": "Rarity",
        "value": "Legendary"
      }
    ],
    "rarity": "Legendary",
    "collection": "Digital Art Collection"
  },
  "status": "draft",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### Get NFTs

**Endpoint**: `GET /nfts`  
**Auth**: Required

**Query Parameters**:
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `status` (string): Filter by status (`draft`, `active`, `sold`, `cancelled`)
- `collection` (string): Filter by collection name

**Response** `200 OK`:
```json
[
  {
    "_id": "60f1b2b3b3b3b3b3b3b3b3b3",
    "title": "Amazing Digital Art",
    "status": "active",
    "metadata": {
      "rarity": "Legendary"
    },
    "createdAt": "2023-01-01T00:00:00.000Z"
  }
]
```

### Get NFT by ID

**Endpoint**: `GET /nfts/:id`  
**Auth**: Required

**Response** `200 OK`:
```json
{
  "_id": "60f1b2b3b3b3b3b3b3b3b3b3",
  "title": "Amazing Digital Art",
  "description": "A unique piece of digital artwork",
  "imageUrl": "https://example.com/nft-image.jpg",
  "metadata": {
    "attributes": [
      {
        "trait_type": "Color",
        "value": "Blue"
      }
    ],
    "rarity": "Legendary",
    "collection": "Digital Art Collection"
  },
  "status": "active",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### Update NFT Status

**Endpoint**: `PATCH /nfts/:id/status`  
**Auth**: Required (Admin)

**Request Body**:
```json
{
  "status": "active"
}
```

**Response** `200 OK`:
```json
{
  "_id": "60f1b2b3b3b3b3b3b3b3b3b3",
  "title": "Amazing Digital Art",
  "status": "active",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

## Auction Management

### Create Auction

**Endpoint**: `POST /auctions`  
**Auth**: Required (Admin)

**Request Body**:
```json
{
  "nftId": "60f1b2b3b3b3b3b3b3b3b3b3",
  "title": "Amazing Art Auction",
  "description": "Auction for amazing digital artwork",
  "startingPrice": 100,
  "whitelistConfig": {
    "maxParticipants": 50,
    "entryFee": 25,
    "startTime": "2023-12-01T10:00:00.000Z",
    "endTime": "2023-12-01T18:00:00.000Z"
  },
  "auctionConfig": {
    "startTime": "2023-12-01T20:00:00.000Z",
    "endTime": "2023-12-02T20:00:00.000Z",
    "minBidIncrement": 10,
    "reservePrice": 200,
    "buyNowPrice": 1000
  }
}
```

**Response** `201 Created`:
```json
{
  "_id": "60f1b2b3b3b3b3b3b3b3b3b4",
  "nftId": "60f1b2b3b3b3b3b3b3b3b3b3",
  "title": "Amazing Art Auction",
  "description": "Auction for amazing digital artwork",
  "startingPrice": 100,
  "currentHighestBid": 0,
  "currentWinner": null,
  "status": "draft",
  "whitelistConfig": {
    "maxParticipants": 50,
    "entryFee": 25,
    "startTime": "2023-12-01T10:00:00.000Z",
    "endTime": "2023-12-01T18:00:00.000Z",
    "isActive": false
  },
  "auctionConfig": {
    "startTime": "2023-12-01T20:00:00.000Z",
    "endTime": "2023-12-02T20:00:00.000Z",
    "minBidIncrement": 10,
    "reservePrice": 200,
    "buyNowPrice": 1000
  },
  "totalBids": 0,
  "totalParticipants": 0,
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### Get Auctions

**Endpoint**: `GET /auctions`  
**Auth**: Required

**Query Parameters**:
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20, max: 100)
- `status` (string): Filter by status (`draft`, `whitelist_open`, `whitelist_closed`, `auction_active`, `ended`)
- `sortBy` (string): Sort field (`createdAt`, `startingPrice`, `endTime`)
- `sortOrder` (string): Sort order (`asc`, `desc`)

**Response** `200 OK`:
```json
[
  {
    "_id": "60f1b2b3b3b3b3b3b3b3b3b4",
    "title": "Amazing Art Auction",
    "startingPrice": 100,
    "currentHighestBid": 250,
    "status": "auction_active",
    "totalBids": 15,
    "totalParticipants": 8,
    "auctionConfig": {
      "endTime": "2023-12-02T20:00:00.000Z"
    },
    "createdAt": "2023-01-01T00:00:00.000Z"
  }
]
```

### Get Auction by ID

**Endpoint**: `GET /auctions/:id`  
**Auth**: Required

**Response** `200 OK`:
```json
{
  "_id": "60f1b2b3b3b3b3b3b3b3b3b4",
  "nftId": {
    "_id": "60f1b2b3b3b3b3b3b3b3b3b3",
    "title": "Amazing Digital Art",
    "imageUrl": "https://example.com/nft-image.jpg"
  },
  "title": "Amazing Art Auction",
  "description": "Auction for amazing digital artwork",
  "startingPrice": 100,
  "currentHighestBid": 250,
  "currentWinner": {
    "_id": "60f1b2b3b3b3b3b3b3b3b3b5",
    "username": "bidder123"
  },
  "status": "auction_active",
  "whitelistConfig": {
    "maxParticipants": 50,
    "entryFee": 25,
    "startTime": "2023-12-01T10:00:00.000Z",
    "endTime": "2023-12-01T18:00:00.000Z",
    "isActive": false
  },
  "auctionConfig": {
    "startTime": "2023-12-01T20:00:00.000Z",
    "endTime": "2023-12-02T20:00:00.000Z",
    "minBidIncrement": 10,
    "reservePrice": 200,
    "buyNowPrice": 1000
  },
  "totalBids": 15,
  "totalParticipants": 8,
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T12:30:00.000Z"
}
```

## Whitelist Management

### Join Whitelist

**Endpoint**: `POST /auctions/:id/whitelist/join`  
**Auth**: Required

**Response** `201 Created`:
```json
{
  "_id": "60f1b2b3b3b3b3b3b3b3b3b6",
  "auctionId": "60f1b2b3b3b3b3b3b3b3b3b4",
  "operatorId": "60f1b2b3b3b3b3b3b3b3b3b5",
  "entryFeePaid": 25,
  "paymentTransactionId": "tx_abc123",
  "status": "confirmed",
  "joinedAt": "2023-01-01T12:00:00.000Z",
  "createdAt": "2023-01-01T12:00:00.000Z"
}
```

### Check Whitelist Status

**Endpoint**: `GET /auctions/:id/whitelist/status`  
**Auth**: Required

**Response** `200 OK`:
```json
{
  "isWhitelisted": true,
  "whitelistEntry": {
    "_id": "60f1b2b3b3b3b3b3b3b3b3b6",
    "status": "confirmed",
    "joinedAt": "2023-01-01T12:00:00.000Z"
  },
  "auctionStatus": "whitelist_open",
  "spotsRemaining": 42
}
```

### Get Whitelist Participants

**Endpoint**: `GET /auctions/:id/whitelist`  
**Auth**: Required (Admin)

**Query Parameters**:
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)

**Response** `200 OK`:
```json
[
  {
    "_id": "60f1b2b3b3b3b3b3b3b3b3b6",
    "operatorId": {
      "_id": "60f1b2b3b3b3b3b3b3b3b3b5",
      "username": "user123"
    },
    "entryFeePaid": 25,
    "status": "confirmed",
    "joinedAt": "2023-01-01T12:00:00.000Z"
  }
]
```

## Bidding System

### Place Bid

**Endpoint**: `POST /auctions/:id/bids`  
**Auth**: Required

**Request Body**:
```json
{
  "amount": 150,
  "bidType": "regular",
  "metadata": {
    "source": "web",
    "userAgent": "Mozilla/5.0...",
    "note": "My first bid!"
  }
}
```

**Response** `201 Created`:
```json
{
  "_id": "60f1b2b3b3b3b3b3b3b3b3b7",
  "auctionId": "60f1b2b3b3b3b3b3b3b3b3b4",
  "bidderId": "60f1b2b3b3b3b3b3b3b3b3b5",
  "amount": 150,
  "bidType": "regular",
  "status": "confirmed",
  "transactionId": "tx_bid_xyz789",
  "metadata": {
    "source": "web",
    "userAgent": "Mozilla/5.0...",
    "timestamp": "2023-01-01T14:30:00.000Z"
  },
  "createdAt": "2023-01-01T14:30:00.000Z"
}
```

### Get Bid History

**Endpoint**: `GET /auctions/:id/bids`  
**Auth**: Required

**Query Parameters**:
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `sortOrder` (string): Sort order (`asc`, `desc`, default: `desc`)

**Response** `200 OK`:
```json
[
  {
    "_id": "60f1b2b3b3b3b3b3b3b3b3b7",
    "bidder": {
      "_id": "60f1b2b3b3b3b3b3b3b3b3b5",
      "username": "bidder123"
    },
    "amount": 150,
    "bidType": "regular",
    "status": "confirmed",
    "createdAt": "2023-01-01T14:30:00.000Z"
  },
  {
    "_id": "60f1b2b3b3b3b3b3b3b3b3b8",
    "bidder": {
      "_id": "60f1b2b3b3b3b3b3b3b3b3b9",
      "username": "competitor456"
    },
    "amount": 130,
    "bidType": "regular",
    "status": "outbid",
    "createdAt": "2023-01-01T14:15:00.000Z"
  }
]
```

### Get User's Bids

**Endpoint**: `GET /auctions/:id/bids/my-bids`  
**Auth**: Required

**Query Parameters**:
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)

**Response** `200 OK`:
```json
[
  {
    "_id": "60f1b2b3b3b3b3b3b3b3b3b7",
    "amount": 150,
    "bidType": "regular",
    "status": "winning",
    "createdAt": "2023-01-01T14:30:00.000Z"
  },
  {
    "_id": "60f1b2b3b3b3b3b3b3b3b3ba",
    "amount": 120,
    "bidType": "regular",
    "status": "outbid",
    "createdAt": "2023-01-01T14:10:00.000Z"
  }
]
```

## Auction Lifecycle Management

### Get Lifecycle Status

**Endpoint**: `GET /auctions/:id/lifecycle`  
**Auth**: Required

**Response** `200 OK`:
```json
{
  "currentStatus": "auction_active",
  "timeline": [
    {
      "status": "draft",
      "timestamp": "2023-01-01T00:00:00.000Z",
      "action": "auction_created"
    },
    {
      "status": "whitelist_open", 
      "timestamp": "2023-12-01T10:00:00.000Z",
      "action": "whitelist_opened"
    },
    {
      "status": "whitelist_closed",
      "timestamp": "2023-12-01T18:00:00.000Z", 
      "action": "whitelist_closed"
    },
    {
      "status": "auction_active",
      "timestamp": "2023-12-01T20:00:00.000Z",
      "action": "auction_started"
    }
  ],
  "nextTransition": {
    "toStatus": "ended",
    "scheduledTime": "2023-12-02T20:00:00.000Z",
    "action": "auction_ended"
  },
  "timeRemaining": 3600000
}
```

### Trigger State Transition

**Endpoint**: `POST /auctions/:id/lifecycle/trigger`  
**Auth**: Required (Admin)

**Response** `200 OK`:
```json
{
  "success": true,
  "message": "State transition completed successfully",
  "previousStatus": "whitelist_open",
  "newStatus": "whitelist_closed", 
  "timestamp": "2023-01-01T15:00:00.000Z",
  "transitionType": "manual"
}
```

### Get Processing Status

**Endpoint**: `GET /auctions/lifecycle/status`  
**Auth**: Required (Admin)

**Response** `200 OK`:
```json
{
  "isRunning": true,
  "processingInterval": "every minute",
  "lastProcessed": "2023-01-01T15:30:00.000Z",
  "nextProcessing": "2023-01-01T15:31:00.000Z",
  "activeAuctions": 5,
  "pendingTransitions": 2,
  "health": "healthy"
}
```

## Queue System

### Get Queue Health

**Endpoint**: `GET /queue/health`  
**Auth**: Required (Admin)

**Response** `200 OK`:
```json
{
  "isHealthy": true,
  "metrics": {
    "active": 3,
    "waiting": 0,
    "completed": 1247,
    "failed": 2,
    "delayed": 0
  },
  "redisConnection": "connected",
  "lastProcessed": "2023-01-01T15:30:45.000Z",
  "averageProcessingTime": 234
}
```

### Get Queue Metrics

**Endpoint**: `GET /queue/metrics`  
**Auth**: Required (Admin)

**Response** `200 OK`:
```json
{
  "active": 3,
  "waiting": 0,
  "completed": 1247,
  "failed": 2,
  "delayed": 0,
  "processingRate": 45.2,
  "averageWaitTime": 123,
  "failureRate": 0.16
}
```

## Error Responses

### Error Format

All API errors follow a consistent format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    {
      "field": "amount",
      "message": "Amount must be greater than current highest bid"
    }
  ],
  "timestamp": "2023-01-01T15:30:00.000Z",
  "path": "/auctions/60f1b2b3b3b3b3b3b3b3b3b4/bids"
}
```

### Common Error Codes

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 400 | Bad Request | Invalid input data or business logic violation |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions for the operation |
| 404 | Not Found | Requested resource does not exist |
| 409 | Conflict | Resource state conflict (e.g., already exists) |
| 422 | Unprocessable Entity | Valid syntax but semantically incorrect |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |

### Specific Error Cases

#### Bidding Errors

```json
{
  "statusCode": 400,
  "message": "Bid amount too low",
  "error": "INSUFFICIENT_BID_AMOUNT",
  "details": {
    "minimumRequired": 160,
    "provided": 150,
    "currentHighestBid": 150,
    "minIncrement": 10
  }
}
```

#### Whitelist Errors

```json
{
  "statusCode": 403,
  "message": "Not whitelisted for this auction",
  "error": "NOT_WHITELISTED",
  "details": {
    "auctionId": "60f1b2b3b3b3b3b3b3b3b3b4",
    "whitelistStatus": "not_joined"
  }
}
```

#### Balance Errors

```json
{
  "statusCode": 400,
  "message": "Insufficient HASH balance",
  "error": "INSUFFICIENT_BALANCE",
  "details": {
    "required": 150,
    "available": 100,
    "currency": "HASH"
  }
}
```

## Rate Limiting

The API implements rate limiting to ensure fair usage:

| Endpoint Type | Rate Limit | Window |
|---------------|------------|---------|
| Authentication | 5 requests | 1 minute |
| Bidding | 10 requests | 1 minute |
| General API | 100 requests | 1 minute |
| Admin Operations | 50 requests | 1 minute |

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1672531200
```

## Pagination

All list endpoints support pagination:

**Request Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response Headers**:
```http
X-Total-Count: 247
X-Page-Count: 13
X-Current-Page: 1
X-Per-Page: 20
```

## Data Types

### Auction Status
- `draft`: Auction created but not started
- `whitelist_open`: Whitelist registration is active
- `whitelist_closed`: Whitelist closed, auction not started
- `auction_active`: Auction is live and accepting bids
- `ended`: Auction completed

### Bid Types
- `regular`: Standard bid
- `buy_now`: Immediate purchase at buy-now price

### NFT Status
- `draft`: NFT created but not active
- `active`: NFT available for auction
- `in_auction`: NFT currently in an active auction
- `sold`: NFT has been sold
- `cancelled`: NFT listing cancelled

## WebSocket Events

For real-time functionality, see [WebSocket Documentation](./websocket.md).

## SDKs and Examples

For code examples and SDKs, see the [examples directory](../examples/).

## Changelog

### v1.0.0
- Initial API release
- Complete auction lifecycle support
- Real-time bidding via WebSocket
- Queue-based high-frequency bid processing 