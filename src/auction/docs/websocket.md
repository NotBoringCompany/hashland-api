# WebSocket Documentation

## Overview

The Auction System provides real-time functionality through WebSocket connections using Socket.IO. This enables live bidding updates, auction status changes, and immediate notifications for all participants.

**Namespace**: `/auction`  
**Protocol**: Socket.IO  
**Authentication**: JWT Bearer Token

## Connection Setup

### Client Connection

```javascript
import io from 'socket.io-client';

const socket = io('ws://localhost:3000/auction', {
  auth: {
    token: 'your-jwt-token'
  },
  // Alternative authentication methods
  extraHeaders: {
    'Authorization': 'Bearer your-jwt-token'
  },
  query: {
    token: 'your-jwt-token'
  }
});

// Connection events
socket.on('connect', () => {
  console.log('Connected to auction system');
});

socket.on('disconnect', () => {
  console.log('Disconnected from auction system');
});

socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
});
```

### Authentication

The WebSocket gateway supports multiple authentication methods:

1. **Auth object** (recommended):
   ```javascript
   { auth: { token: 'your-jwt-token' } }
   ```

2. **Authorization header**:
   ```javascript
   { extraHeaders: { 'Authorization': 'Bearer your-jwt-token' } }
   ```

3. **Query parameter**:
   ```javascript
   { query: { token: 'your-jwt-token' } }
   ```

### Connection Confirmation

Upon successful connection and authentication:

```javascript
socket.on('connection_confirmed', (data) => {
  console.log('Authenticated as:', data.operatorId);
  console.log('Connection ID:', data.socketId);
  console.log('Connected at:', data.timestamp);
});
```

## Room Management

### Joining Auction Rooms

Join specific auction rooms to receive real-time updates:

```javascript
// Join auction room
socket.emit('join_auction', {
  auctionId: '60f1b2b3b3b3b3b3b3b3b3b4'
});

// Confirmation of joining
socket.on('user_joined', (data) => {
  console.log('Joined auction:', data.auctionId);
  console.log('Room participants:', data.participantCount);
});
```

### Leaving Auction Rooms

```javascript
// Leave auction room
socket.emit('leave_auction', {
  auctionId: '60f1b2b3b3b3b3b3b3b3b3b4'
});

// Confirmation of leaving
socket.on('user_left', (data) => {
  console.log('Left auction:', data.auctionId);
});
```

## Bidding Events

### Placing Bids

```javascript
// Place bid via WebSocket
socket.emit('place_bid', {
  auctionId: '60f1b2b3b3b3b3b3b3b3b3b4',
  amount: 150,
  bidType: 'regular',
  metadata: {
    source: 'websocket',
    userAgent: navigator.userAgent,
    note: 'Quick bid from mobile'
  }
});

// Bid placement confirmation
socket.on('bid_placed', (data) => {
  console.log('Bid placed successfully:', data);
  // {
  //   success: true,
  //   bidId: '60f1b2b3b3b3b3b3b3b3b3b7',
  //   amount: 150,
  //   position: 1,
  //   timestamp: '2023-01-01T14:30:00.000Z'
  // }
});

// Bid placement error
socket.on('bid_error', (error) => {
  console.error('Bid failed:', error);
  // {
  //   error: 'INSUFFICIENT_BID_AMOUNT',
  //   message: 'Bid amount too low',
  //   details: {
  //     minimumRequired: 160,
  //     provided: 150
  //   }
  // }
});
```

### Receiving Bid Updates

```javascript
// New bid placed by any user
socket.on('new_bid', (data) => {
  console.log('New bid placed:', data);
  // {
  //   auctionId: '60f1b2b3b3b3b3b3b3b3b3b4',
  //   bidId: '60f1b2b3b3b3b3b3b3b3b3b8',
  //   amount: 180,
  //   bidder: {
  //     id: '60f1b2b3b3b3b3b3b3b3b3b9',
  //     username: 'competitor456'
  //   },
  //   bidType: 'regular',
  //   timestamp: '2023-01-01T14:35:00.000Z',
  //   isNewLeader: true
  // }
});

// User's bid was outbid
socket.on('bid_outbid', (data) => {
  console.log('Your bid was outbid:', data);
  // {
  //   auctionId: '60f1b2b3b3b3b3b3b3b3b3b4',
  //   yourBidId: '60f1b2b3b3b3b3b3b3b3b3b7',
  //   yourAmount: 150,
  //   newHighestBid: 180,
  //   newLeader: {
  //     username: 'competitor456'
  //   },
  //   timestamp: '2023-01-01T14:35:00.000Z'
  // }
});
```

## Auction Status Events

### Getting Current Status

```javascript
// Request current auction status
socket.emit('get_auction_status', {
  auctionId: '60f1b2b3b3b3b3b3b3b3b3b4'
});

// Receive auction status
socket.on('auction_status', (data) => {
  console.log('Auction status:', data);
  // {
  //   auctionId: '60f1b2b3b3b3b3b3b3b3b3b4',
  //   status: 'auction_active',
  //   currentHighestBid: 180,
  //   currentWinner: {
  //     username: 'competitor456'
  //   },
  //   totalBids: 12,
  //   totalParticipants: 8,
  //   timeRemaining: 3600000,
  //   lastUpdate: '2023-01-01T14:35:00.000Z'
  // }
});
```

### Auction Lifecycle Events

```javascript
// Auction status changes
socket.on('auction_updated', (data) => {
  console.log('Auction updated:', data);
  // {
  //   auctionId: '60f1b2b3b3b3b3b3b3b3b3b4',
  //   previousStatus: 'whitelist_open',
  //   newStatus: 'whitelist_closed',
  //   timestamp: '2023-01-01T18:00:00.000Z',
  //   action: 'whitelist_closed'
  // }
});

// Whitelist status changes
socket.on('whitelist_status_changed', (data) => {
  console.log('Whitelist status changed:', data);
  // {
  //   auctionId: '60f1b2b3b3b3b3b3b3b3b3b4',
  //   status: 'closed',
  //   totalParticipants: 47,
  //   maxParticipants: 50,
  //   closedAt: '2023-01-01T18:00:00.000Z'
  // }
});

// Auction ending warnings
socket.on('auction_ending_soon', (data) => {
  console.log('Auction ending soon:', data);
  // {
  //   auctionId: '60f1b2b3b3b3b3b3b3b3b3b4',
  //   timeRemaining: 300000, // 5 minutes in milliseconds
  //   warningType: '5_minutes',
  //   finalBidReminder: true
  // }
});

// Auction ended
socket.on('auction_ended', (data) => {
  console.log('Auction ended:', data);
  // {
  //   auctionId: '60f1b2b3b3b3b3b3b3b3b3b4',
  //   winner: {
  //     id: '60f1b2b3b3b3b3b3b3b3b3b9',
  //     username: 'competitor456'
  //   },
  //   winningBid: 350,
  //   totalBids: 28,
  //   endedAt: '2023-01-01T20:00:00.000Z',
  //   reason: 'time_expired'
  // }
});
```

## Error Handling

### Connection Errors

```javascript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
  
  // Common error types
  switch (error.type) {
    case 'AUTHENTICATION_FAILED':
      // Invalid or expired token
      redirectToLogin();
      break;
    case 'RATE_LIMIT_EXCEEDED':
      // Too many connection attempts
      setTimeout(() => socket.connect(), 60000);
      break;
    case 'SERVER_ERROR':
      // Server-side error
      showErrorMessage('Server temporarily unavailable');
      break;
  }
});
```

### Operation Errors

```javascript
socket.on('error', (error) => {
  console.error('Operation error:', error);
  // {
  //   type: 'VALIDATION_ERROR',
  //   message: 'Invalid auction ID format',
  //   details: {
  //     field: 'auctionId',
  //     provided: 'invalid-id'
  //   }
  // }
});
```

## Rate Limiting

### Bid Rate Limiting

The system implements rate limiting for bid submissions:

```javascript
socket.on('rate_limit_exceeded', (data) => {
  console.warn('Rate limit exceeded:', data);
  // {
  //   type: 'BID_RATE_LIMIT',
  //   limit: 10,
  //   window: 60000,
  //   resetTime: '2023-01-01T14:31:00.000Z',
  //   retryAfter: 15000
  // }
  
  // Wait before retrying
  setTimeout(() => {
    // Retry bid submission
  }, data.retryAfter);
});
```

### Connection Rate Limiting

```javascript
socket.on('connect_error', (error) => {
  if (error.type === 'RATE_LIMIT_EXCEEDED') {
    const retryAfter = error.data.retryAfter;
    console.log(`Rate limited. Retry after ${retryAfter}ms`);
    
    setTimeout(() => {
      socket.connect();
    }, retryAfter);
  }
});
```

## Best Practices

### Connection Management

```javascript
class AuctionWebSocket {
  constructor(token) {
    this.token = token;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    this.socket = io('ws://localhost:3000/auction', {
      auth: { token: this.token },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('Connected to auction system');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      
      if (reason === 'io server disconnect') {
        // Server disconnected, don't reconnect automatically
        return;
      }
      
      this.handleReconnection();
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.handleReconnection();
    });
  }

  handleReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
      
      setTimeout(() => {
        console.log(`Reconnection attempt ${this.reconnectAttempts}`);
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.onMaxReconnectAttemptsReached();
    }
  }

  onMaxReconnectAttemptsReached() {
    // Implement fallback behavior
    // e.g., show offline message, switch to HTTP polling
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}
```

### Event Management

```javascript
class AuctionEventManager {
  constructor(socket) {
    this.socket = socket;
    this.eventListeners = new Map();
  }

  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
      
      // Set up socket listener
      this.socket.on(event, (data) => {
        const listeners = this.eventListeners.get(event) || [];
        listeners.forEach(listener => {
          try {
            listener(data);
          } catch (error) {
            console.error(`Error in event listener for ${event}:`, error);
          }
        });
      });
    }

    this.eventListeners.get(event).push(callback);
  }

  off(event, callback) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    this.socket.emit(event, data);
  }

  cleanup() {
    this.eventListeners.clear();
    this.socket.removeAllListeners();
  }
}
```

### Auction Room Management

```javascript
class AuctionRoomManager {
  constructor(eventManager) {
    this.eventManager = eventManager;
    this.joinedRooms = new Set();
  }

  joinAuction(auctionId) {
    if (this.joinedRooms.has(auctionId)) {
      console.log(`Already in auction room: ${auctionId}`);
      return;
    }

    this.eventManager.emit('join_auction', { auctionId });
    this.joinedRooms.add(auctionId);

    // Set up auction-specific listeners
    this.setupAuctionListeners(auctionId);
  }

  leaveAuction(auctionId) {
    if (!this.joinedRooms.has(auctionId)) {
      console.log(`Not in auction room: ${auctionId}`);
      return;
    }

    this.eventManager.emit('leave_auction', { auctionId });
    this.joinedRooms.delete(auctionId);

    // Clean up auction-specific listeners
    this.cleanupAuctionListeners(auctionId);
  }

  setupAuctionListeners(auctionId) {
    this.eventManager.on('new_bid', (data) => {
      if (data.auctionId === auctionId) {
        this.handleNewBid(data);
      }
    });

    this.eventManager.on('auction_updated', (data) => {
      if (data.auctionId === auctionId) {
        this.handleAuctionUpdate(data);
      }
    });
  }

  handleNewBid(data) {
    // Update UI with new bid
    console.log('New bid in auction:', data);
  }

  handleAuctionUpdate(data) {
    // Update auction status in UI
    console.log('Auction updated:', data);
  }

  leaveAllAuctions() {
    this.joinedRooms.forEach(auctionId => {
      this.leaveAuction(auctionId);
    });
  }
}
```

## Testing WebSocket Connections

### Unit Testing

```javascript
import { io } from 'socket.io-client';

describe('Auction WebSocket', () => {
  let clientSocket;
  let serverSocket;

  beforeAll((done) => {
    // Start test server
    server.listen(() => {
      const port = server.address().port;
      clientSocket = io(`http://localhost:${port}/auction`, {
        auth: { token: 'test-token' }
      });
      
      server.on('connection', (socket) => {
        serverSocket = socket;
      });
      
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    server.close();
    clientSocket.close();
  });

  test('should connect with valid token', (done) => {
    clientSocket.on('connection_confirmed', (data) => {
      expect(data.operatorId).toBeDefined();
      done();
    });
  });

  test('should place bid successfully', (done) => {
    clientSocket.emit('place_bid', {
      auctionId: 'test-auction-id',
      amount: 100,
      bidType: 'regular'
    });

    clientSocket.on('bid_placed', (data) => {
      expect(data.success).toBe(true);
      expect(data.amount).toBe(100);
      done();
    });
  });
});
```

## Security Considerations

### Token Management

```javascript
class SecureTokenManager {
  constructor() {
    this.token = null;
    this.refreshTimer = null;
  }

  setToken(token) {
    this.token = token;
    this.scheduleTokenRefresh();
  }

  scheduleTokenRefresh() {
    // Refresh token before expiration
    const tokenPayload = this.parseJWT(this.token);
    const expiresAt = tokenPayload.exp * 1000;
    const refreshTime = expiresAt - Date.now() - 60000; // 1 minute before expiry

    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshToken();
      }, refreshTime);
    }
  }

  parseJWT(token) {
    try {
      return JSON.parse(atob(token.split('.')[1]));
    } catch (error) {
      console.error('Invalid JWT token');
      return {};
    }
  }

  async refreshToken() {
    try {
      const response = await fetch('/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.setToken(data.access_token);
        
        // Reconnect socket with new token
        this.reconnectSocket();
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
  }
}
```

### Input Validation

```javascript
function validateBidInput(bidData) {
  const errors = [];

  if (!bidData.auctionId || typeof bidData.auctionId !== 'string') {
    errors.push('Invalid auction ID');
  }

  if (!bidData.amount || typeof bidData.amount !== 'number' || bidData.amount <= 0) {
    errors.push('Invalid bid amount');
  }

  if (!['regular', 'buy_now'].includes(bidData.bidType)) {
    errors.push('Invalid bid type');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Usage
function placeBid(bidData) {
  const validation = validateBidInput(bidData);
  
  if (!validation.isValid) {
    console.error('Invalid bid data:', validation.errors);
    return;
  }

  socket.emit('place_bid', bidData);
}
```

## Troubleshooting

### Common Issues

#### Connection Issues
- **Invalid Token**: Ensure JWT token is valid and not expired
- **CORS Errors**: Configure CORS settings on the server
- **Network Issues**: Check firewall and network connectivity

#### Event Issues
- **Events Not Received**: Verify room membership and event listeners
- **Memory Leaks**: Properly remove event listeners when components unmount
- **Rate Limiting**: Implement proper rate limiting handling

#### Performance Issues
- **Too Many Connections**: Implement connection pooling
- **Heavy Event Traffic**: Debounce or throttle event handlers
- **Memory Usage**: Monitor and cleanup unused connections

### Debugging

```javascript
// Enable Socket.IO debug logging
localStorage.debug = 'socket.io-client:socket';

// Monitor connection state
socket.on('connect', () => console.log('Connected'));
socket.on('disconnect', (reason) => console.log('Disconnected:', reason));
socket.on('connect_error', (error) => console.error('Connection error:', error));

// Log all events
const originalOn = socket.on;
socket.on = function(event, callback) {
  return originalOn.call(this, event, (...args) => {
    console.log(`[${event}]`, ...args);
    return callback(...args);
  });
};
``` 