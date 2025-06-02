# Auction System API Documentation

This document provides comprehensive API reference for the Auction System, including endpoints for auction management, whitelist operations, bidding, and real-time WebSocket functionality.

## Table of Contents

1. [Authentication](#authentication)
2. [Base URL & Versioning](#base-url--versioning)
3. [Error Handling](#error-handling)
4. [Rate Limiting](#rate-limiting)
5. [Auction Management](#auction-management)
6. [Whitelist Management](#whitelist-management)
7. [Bidding System](#bidding-system)
8. [Auction Lifecycle](#auction-lifecycle-management)
9. [Queue System](#queue-system)
10. [WebSocket Events](#websocket-events)
11. [Admin Operations](#admin-operations)

## Authentication

All API endpoints require authentication using JWT tokens.

**Headers Required**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Authentication Flow**:
1. Obtain JWT token from auth service
2. Include token in Authorization header
3. Token contains operator information for permission checks

## Base URL & Versioning

**Base URL**: `https://api.hashland.com/v1`  
**Current Version**: v1  
**Protocol**: HTTPS only

## Error Handling

**Standard Error Response**:
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
  "timestamp": "2023-01-01T00:00:00.000Z",
  "path": "/auctions/60f1b2b3b3b3b3b3b3b3b3b4/bids"
}
```

**HTTP Status Codes**:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (business rule violation)
- `429` - Too Many Requests (rate limiting)
- `500` - Internal Server Error

## Rate Limiting

**Limits**:
- General API: 100 requests/minute per IP
- Bidding endpoints: 30 requests/minute per user
- WebSocket connections: 5 connections/minute per IP

**Rate Limit Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Auction Management

### Create Auction

**Endpoint**: `POST /auctions`  
**Auth**: Required (Admin)

**Request Body**:
```json
{
  "nft": "60f1b2b3b3b3b3b3b3b3b3b3",
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
  "nft": "60f1b2b3b3b3b3b3b3b3b3b3",
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
  "nft": {
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
  "auction": "60f1b2b3b3b3b3b3b3b3b3b4",
  "operator": "60f1b2b3b3b3b3b3b3b3b3b5",
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
    "operator": {
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
  "auction": "60f1b2b3b3b3b3b3b3b3b3b4",
  "bidder": "60f1b2b3b3b3b3b3b3b3b3b5",
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
  "lastProcessed": "2023-01-01T15:45:00.000Z",
  "avgProcessingTime": 150,
  "throughput": {
    "perMinute": 45,
    "perHour": 2700
  }
}
```

### Queue Bid Processing

**Endpoint**: `POST /auctions/:id/bids/queue`  
**Auth**: Required

**Request Body**:
```json
{
  "amount": 175,
  "bidType": "regular",
  "metadata": {
    "source": "api",
    "priority": "normal"
  }
}
```

**Response** `202 Accepted`:
```json
{
  "jobId": "job_bid_abc123xyz",
  "message": "Bid queued for processing",
  "queuePosition": 3,
  "estimatedProcessTime": "2023-01-01T15:47:30.000Z",
  "auction": "60f1b2b3b3b3b3b3b3b3b3b4",
  "bidder": "60f1b2b3b3b3b3b3b3b3b3b5"
}
```

### Get Queue Status

**Endpoint**: `GET /queue/jobs/:jobId`  
**Auth**: Required

**Response** `200 OK`:
```json
{
  "jobId": "job_bid_abc123xyz",
  "status": "processing",
  "progress": 75,
  "data": {
    "auction": "60f1b2b3b3b3b3b3b3b3b3b4",
    "bidder": "60f1b2b3b3b3b3b3b3b3b3b5",
    "amount": 175
  },
  "result": null,
  "error": null,
  "createdAt": "2023-01-01T15:46:00.000Z",
  "processedAt": "2023-01-01T15:46:15.000Z",
  "completedAt": null
}
```

## WebSocket Events

### Connection

**Namespace**: `/auction`  
**Auth**: JWT token via query parameter or handshake auth

**Connection URL**:
```
wss://api.hashland.com/auction?token=<jwt_token>
```

### Event Types

#### Client → Server Events

**join_auction**:
```json
{
  "auctionId": "60f1b2b3b3b3b3b3b3b3b3b4"
}
```

**leave_auction**:
```json
{
  "auctionId": "60f1b2b3b3b3b3b3b3b3b3b4"
}
```

**place_bid**:
```json
{
  "bidder": "60f1b2b3b3b3b3b3b3b3b3b5",
  "amount": 200,
  "bidType": "regular",
  "metadata": {
    "note": "Final bid!"
  }
}
```

**get_auction_status**:
```json
{
  "auctionId": "60f1b2b3b3b3b3b3b3b3b3b4"
}
```

#### Server → Client Events

**connection_confirmed**:
```json
{
  "message": "Connected to auction system",
  "operator": "60f1b2b3b3b3b3b3b3b3b3b5",
  "timestamp": "2023-01-01T15:50:00.000Z"
}
```

**auction_status**:
```json
{
  "auction": {
    "_id": "60f1b2b3b3b3b3b3b3b3b3b4",
    "title": "Amazing Art Auction",
    "currentHighestBid": 250,
    "status": "auction_active",
    "timeRemaining": 3600000
  },
  "timestamp": "2023-01-01T15:50:00.000Z"
}
```

**new_bid**:
```json
{
  "bid": {
    "_id": "60f1b2b3b3b3b3b3b3b3b3b8",
    "bidder": {
      "_id": "60f1b2b3b3b3b3b3b3b3b3b6",
      "username": "newbidder"
    },
    "amount": 275,
    "createdAt": "2023-01-01T15:51:00.000Z"
  },
  "auction": {
    "currentHighestBid": 275,
    "totalBids": 16
  },
  "timestamp": "2023-01-01T15:51:00.000Z"
}
```

**bid_placed**:
```json
{
  "bid": {
    "_id": "60f1b2b3b3b3b3b3b3b3b3b8",
    "amount": 275,
    "status": "confirmed"
  },
  "message": "Bid placed successfully",
  "queued": false,
  "timestamp": "2023-01-01T15:51:00.000Z"
}
```

**bid_outbid**:
```json
{
  "previousBid": {
    "_id": "60f1b2b3b3b3b3b3b3b3b3b7",
    "amount": 250
  },
  "newHighestBid": 275,
  "newLeader": "newbidder",
  "timestamp": "2023-01-01T15:51:00.000Z"
}
```

**auction_ending_soon**:
```json
{
  "auctionId": "60f1b2b3b3b3b3b3b3b3b3b4",
  "minutesLeft": 5,
  "timestamp": "2023-01-01T15:55:00.000Z"
}
```

**auction_ended**:
```json
{
  "auction": {
    "_id": "60f1b2b3b3b3b3b3b3b3b3b4",
    "status": "ended",
    "finalPrice": 275,
    "winner": {
      "_id": "60f1b2b3b3b3b3b3b3b3b3b6",
      "username": "newbidder"
    }
  },
  "timestamp": "2023-01-01T16:00:00.000Z"
}
```

**error**:
```json
{
  "message": "Insufficient balance for bid",
  "timestamp": "2023-01-01T15:52:00.000Z"
}
```

## Admin Operations

### Get System Statistics

**Endpoint**: `GET /admin/stats`  
**Auth**: Required (Admin)

**Response** `200 OK`:
```json
{
  "auctions": {
    "total": 156,
    "active": 8,
    "completed": 142,
    "draft": 6
  },
  "bids": {
    "total": 4567,
    "today": 89,
    "avgPerAuction": 29.3
  },
  "users": {
    "totalParticipants": 1203,
    "activeToday": 45,
    "whitelistSuccess": 0.87
  },
  "revenue": {
    "totalVolume": 125600,
    "whitelistFees": 3250,
    "avgAuctionValue": 805.12
  }
}
```

### Emergency Stop Auction

**Endpoint**: `POST /admin/auctions/:id/emergency-stop`  
**Auth**: Required (Admin)

**Request Body**:
```json
{
  "reason": "Technical issue detected",
  "refundBids": true,
  "notifyParticipants": true
}
```

**Response** `200 OK`:
```json
{
  "success": true,
  "message": "Auction stopped successfully",
  "auctionId": "60f1b2b3b3b3b3b3b3b3b3b4",
  "stoppedAt": "2023-01-01T15:55:00.000Z",
  "refundsProcessed": 15,
  "participantsNotified": 28
}
```

### Bulk Operations

**Endpoint**: `POST /admin/auctions/bulk`  
**Auth**: Required (Admin)

**Request Body**:
```json
{
  "operation": "extend_whitelist",
  "auctionIds": [
    "60f1b2b3b3b3b3b3b3b3b3b4",
    "60f1b2b3b3b3b3b3b3b3b3b5"
  ],
  "parameters": {
    "extensionMinutes": 30
  }
}
```

**Response** `200 OK`:
```json
{
  "success": true,
  "processed": 2,
  "failed": 0,
  "results": [
    {
      "auctionId": "60f1b2b3b3b3b3b3b3b3b3b4",
      "status": "success",
      "newEndTime": "2023-12-01T18:30:00.000Z"
    },
    {
      "auctionId": "60f1b2b3b3b3b3b3b3b3b3b5", 
      "status": "success",
      "newEndTime": "2023-12-01T18:30:00.000Z"
    }
  ]
}
```

---

## Support

For API support or technical questions:
- **Documentation**: [https://docs.hashland.com/auction-api](https://docs.hashland.com/auction-api)
- **Status Page**: [https://status.hashland.com](https://status.hashland.com)
- **Support**: [api-support@hashland.com](mailto:api-support@hashland.com)

**Rate Limits & Quotas**: Contact support for enterprise limits  
**SLA**: 99.9% uptime guarantee  
**Maintenance Windows**: Sundays 02:00-04:00 UTC