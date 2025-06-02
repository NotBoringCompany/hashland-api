# WebSocket Real-time Communication

## Overview

The Auction System provides real-time bidding and updates through WebSocket connections, enabling instant notifications for bid updates, auction status changes, and user interactions.

**WebSocket Endpoint**: `wss://api.hashland.com/auction`  
**Namespace**: `/auction`  
**Protocol**: Socket.IO v4.x  
**Authentication**: JWT Bearer Token

## Connection Management

### Establishing Connection

**Basic Connection**:
```javascript
import { io } from 'socket.io-client';

const socket = io('wss://api.hashland.com/auction', {
  auth: {
    token: 'your-jwt-token'
  },
  transports: ['websocket']
});
```

**Connection with Options**:
```javascript
const socket = io('wss://api.hashland.com/auction', {
  auth: {
    token: 'your-jwt-token'
  },
  transports: ['websocket'],
  timeout: 20000,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});
```

### Authentication

**JWT Token Authentication**:
```javascript
// Include token in connection auth
const socket = io('wss://api.hashland.com/auction', {
  auth: {
    token: localStorage.getItem('authToken')
  }
});

// Handle authentication response
socket.on('connect', () => {
  console.log('Connected to auction system');
});

socket.on('connection_confirmed', (data) => {
  console.log('Authenticated as:', data.operator);
});

socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
});
```

## Room Management

### Joining Auction Rooms

**Join Auction**:
```javascript
socket.emit('join_auction', {
  auctionId: '60f1b2b3b3b3b3b3b3b3b3b4'
});

socket.on('auction_status', (data) => {
  console.log('Joined auction:', data.auction);
  console.log('Current status:', data.auction.status);
});
```

**Leave Auction**:
```javascript
socket.emit('leave_auction', {
  auctionId: '60f1b2b3b3b3b3b3b3b3b3b4'
});

socket.on('user_left', (data) => {
  console.log('Left auction:', data.auctionId);
});
```

## Real-time Bidding

### Placing Bids

**Standard Bid**:
```javascript
socket.emit('place_bid', {
  auctionId: '60f1b2b3b3b3b3b3b3b3b3b4',
  amount: 150,
  bidType: 'regular',
  metadata: {
    note: 'Great artwork!',
    source: 'web'
  }
});
```

**Buy Now Bid**:
```javascript
socket.emit('place_bid', {
  auctionId: '60f1b2b3b3b3b3b3b3b3b3b4',
  amount: 1000,
  bidType: 'buy_now',
  metadata: {
    note: 'Must have this piece!',
    source: 'web'
  }
});
```

### Bid Responses

**Successful Bid**:
```javascript
socket.on('bid_placed', (data) => {
  if (data.queued) {
    console.log('Bid queued:', data.jobId);
    console.log('Queue position:', data.queuePosition);
  } else {
    console.log('Bid placed immediately:', data.bid);
  }
});
```

**Bid Errors**:
```javascript
socket.on('bid_error', (data) => {
  console.error('Bid failed:', data.message);
  if (data.minAmount) {
    console.log('Minimum bid amount:', data.minAmount);
  }
});
```

## Event Listeners

### Auction Events

**New Bid Notifications**:
```javascript
socket.on('new_bid', (data) => {
  console.log('New bid placed:');
  console.log('Bidder:', data.bid.bidder.username);
  console.log('Amount:', data.bid.amount);
  console.log('New highest bid:', data.auction.currentHighestBid);
  
  // Update UI with new bid information
  updateAuctionDisplay(data.auction);
  addBidToHistory(data.bid);
});
```

**Auction Status Updates**:
```javascript
socket.on('auction_status', (data) => {
  console.log('Auction status update:');
  console.log('Status:', data.auction.status);
  console.log('Time remaining:', data.auction.timeRemaining);
  console.log('Current highest bid:', data.auction.currentHighestBid);
  
  updateAuctionTimer(data.auction.timeRemaining);
  updateBidDisplay(data.auction.currentHighestBid);
});
```

**Outbid Notifications**:
```javascript
socket.on('bid_outbid', (data) => {
  console.log('You have been outbid!');
  console.log('Your bid:', data.previousBid.amount);
  console.log('New highest bid:', data.newHighestBid);
  console.log('New leader:', data.newLeader);
  
  // Show notification to user
  showNotification('You have been outbid!', 'warning');
  
  // Update bid button to show new minimum
  updateMinimumBid(data.newHighestBid);
});
```

**Auction Ending Warnings**:
```javascript
socket.on('auction_ending_soon', (data) => {
  console.log(`Auction ending in ${data.minutesLeft} minutes!`);
  
  // Show urgency indicator
  showEndingWarning(data.minutesLeft);
  
  // Start countdown timer if final minute
  if (data.minutesLeft <= 1) {
    startFinalCountdown();
  }
});
```

**Auction Ended**:
```javascript
socket.on('auction_ended', (data) => {
  console.log('Auction has ended!');
  console.log('Final price:', data.auction.finalPrice);
  console.log('Winner:', data.auction.winner?.username || 'No winner');
  
  // Disable bidding interface
  disableBidding();
  
  // Show final results
  showAuctionResults(data.auction);
});
```

### User Events

**User Joined/Left Room**:
```javascript
socket.on('user_joined', (data) => {
  console.log('User joined auction:', data.operator);
  updateParticipantCount('+1');
});

socket.on('user_left', (data) => {
  console.log('User left auction:', data.operator);
  updateParticipantCount('-1');
});
```

**Whitelist Status Changes**:
```javascript
socket.on('whitelist_status_changed', (data) => {
  console.log('Whitelist status changed:', data.status);
  console.log('Auction:', data.auctionId);
  
  if (data.status === 'closed') {
    showMessage('Whitelist has closed. Auction starting soon!');
  }
});
```

## Error Handling

### Connection Errors

**Connection Lost**:
```javascript
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  
  if (reason === 'io server disconnect') {
    // Server initiated disconnect - don't reconnect automatically
    showError('Connection terminated by server');
  } else {
    // Client or network issue - will auto-reconnect
    showMessage('Connection lost. Reconnecting...');
  }
});
```

**Reconnection Handling**:
```javascript
socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
  
  // Rejoin auction rooms
  rejoinAuctionRooms();
  
  // Refresh auction status
  refreshCurrentAuction();
});

socket.on('reconnect_error', (error) => {
  console.error('Reconnection failed:', error);
});

socket.on('reconnect_failed', () => {
  console.error('Failed to reconnect');
  showError('Unable to reconnect. Please refresh the page.');
});
```

### Validation Errors

**Invalid Data**:
```javascript
socket.on('error', (data) => {
  console.error('Socket error:', data.message);
  
  switch (data.message) {
    case 'Unauthorized':
      // Token expired or invalid
      handleAuthError();
      break;
    case 'Not whitelisted':
      showError('You are not whitelisted for this auction');
      break;
    case 'Auction not found':
      showError('Auction no longer exists');
      break;
    default:
      showError(data.message);
  }
});
```

## Rate Limiting

### Connection Limits

**Rate Limits**:
- **Connections**: 5 per minute per IP
- **Bid Events**: 30 per minute per user
- **Room Join/Leave**: 10 per minute per user

**Rate Limit Handling**:
```javascript
socket.on('bid_error', (data) => {
  if (data.message.includes('rate limit')) {
    console.log('Rate limited. Reset time:', data.resetTime);
    
    // Disable bidding temporarily
    disableBiddingUntil(data.resetTime);
    
    // Show countdown to user
    showRateLimitCountdown(data.resetTime);
  }
});
```

## Complete Example

### Auction Client Implementation

```javascript
class AuctionClient {
  constructor(token) {
    this.token = token;
    this.socket = null;
    this.joinedRooms = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    this.socket = io('wss://api.hashland.com/auction', {
      auth: { token: this.token },
      transports: ['websocket'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to auction system');
      this.reconnectAttempts = 0;
    });

    this.socket.on('connection_confirmed', (data) => {
      console.log('Authenticated as operator:', data.operator);
      this.operator = data.operator;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      this.handleDisconnection(reason);
    });

    // Auction events
    this.socket.on('auction_status', (data) => {
      this.handleAuctionStatus(data);
    });

    this.socket.on('new_bid', (data) => {
      this.handleNewBid(data);
    });

    this.socket.on('bid_placed', (data) => {
      this.handleBidPlaced(data);
    });

    this.socket.on('bid_outbid', (data) => {
      this.handleBidOutbid(data);
    });

    this.socket.on('auction_ending_soon', (data) => {
      this.handleAuctionEndingSoon(data);
    });

    this.socket.on('auction_ended', (data) => {
      this.handleAuctionEnded(data);
    });

    // Error handling
    this.socket.on('error', (data) => {
      this.handleError(data);
    });

    this.socket.on('bid_error', (data) => {
      this.handleBidError(data);
    });
  }

  joinAuction(auctionId) {
    if (this.joinedRooms.has(auctionId)) {
      console.log(`Already in auction room: ${auctionId}`);
      return;
    }

    this.socket.emit('join_auction', { auctionId });
    this.joinedRooms.add(auctionId);

    // Set up auction-specific listeners
    this.setupAuctionListeners(auctionId);
  }

  leaveAuction(auctionId) {
    if (!this.joinedRooms.has(auctionId)) {
      console.log(`Not in auction room: ${auctionId}`);
      return;
    }

    this.socket.emit('leave_auction', { auctionId });
    this.joinedRooms.delete(auctionId);

    // Clean up auction-specific listeners
    this.cleanupAuctionListeners(auctionId);
  }

  setupAuctionListeners(auctionId) {
    // Listen for events specific to this auction
    this.socket.on('auction_updated', (data) => {
      if (data.auctionId === auctionId) {
        this.handleAuctionUpdate(data);
      }
    });

    this.socket.on('user_joined', (data) => {
      if (data.auctionId === auctionId) {
        this.handleUserJoined(data);
      }
    });
  }

  placeBid(auctionId, amount, bidType = 'regular', metadata = {}) {
    if (!this.joinedRooms.has(auctionId)) {
      console.error('Must join auction before bidding');
      return;
    }

    this.socket.emit('place_bid', {
      auctionId,
      amount,
      bidType,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  }

  getAuctionStatus(auctionId) {
    this.socket.emit('get_auction_status', { auctionId });
  }

  // Event handlers
  handleAuctionStatus(data) {
    console.log('Auction status:', data.auction.status);
    // Update UI with auction data
  }

  handleNewBid(data) {
    console.log('New bid:', data.bid);
    // Update bid history and auction display
  }

  handleBidPlaced(data) {
    if (data.queued) {
      console.log('Bid queued with job ID:', data.jobId);
    } else {
      console.log('Bid placed successfully:', data.bid);
    }
  }

  handleBidOutbid(data) {
    console.log('Outbid! New highest bid:', data.newHighestBid);
    // Show notification and update UI
  }

  handleAuctionEndingSoon(data) {
    console.log(`Auction ending in ${data.minutesLeft} minutes!`);
    // Show urgency warnings
  }

  handleAuctionEnded(data) {
    console.log('Auction ended. Winner:', data.auction.winner);
    // Disable bidding and show results
  }

  handleError(data) {
    console.error('Socket error:', data.message);
    // Handle specific error types
  }

  handleBidError(data) {
    console.error('Bid error:', data.message);
    // Show user-friendly error messages
  }

  handleDisconnection(reason) {
    if (reason === 'io server disconnect') {
      // Server terminated connection
      console.log('Server disconnected the client');
    } else {
      // Network or client issue
      console.log('Connection lost, attempting to reconnect...');
    }
  }

  // Cleanup on disconnect
  disconnect() {
    this.joinedRooms.forEach(auctionId => {
      this.leaveAuction(auctionId);
    });
    
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
```

### Usage Example

```javascript
// Initialize auction client
const auctionClient = new AuctionClient(authToken);
auctionClient.connect();

// Join auction and start bidding
const auctionId = '60f1b2b3b3b3b3b3b3b3b3b4';
auctionClient.joinAuction(auctionId);

// Place bid
document.getElementById('bidButton').addEventListener('click', () => {
  const amount = parseFloat(document.getElementById('bidAmount').value);
  auctionClient.placeBid(auctionId, amount, 'regular', {
    note: 'My bid via web interface'
  });
});

// Leave auction when navigating away
window.addEventListener('beforeunload', () => {
  auctionClient.disconnect();
});
```

## Testing WebSocket Events

### Manual Testing

**Connection Test**:
```javascript
const socket = io('wss://api.hashland.com/auction', {
  auth: { token: 'test-token' }
});

socket.on('connect', () => {
  console.log('✓ Connection successful');
});

socket.on('connection_confirmed', (data) => {
  console.log('✓ Authentication successful');
  expect(data.operator).toBeDefined();
});
```

**Bid Flow Test**:
```javascript
// Join auction
socket.emit('join_auction', {
  auctionId: 'test-auction-id',
});

// Wait for confirmation then place bid
socket.on('auction_status', () => {
  socket.emit('place_bid', {
    auctionId: 'test-auction-id',
    amount: 100,
    bidType: 'regular'
  });
});

// Verify bid placement
socket.on('bid_placed', (data) => {
  console.log('✓ Bid placed successfully');
});
```

### Automated Testing

**Jest Test Example**:
```javascript
import { createServer } from 'http';
import { Server } from 'socket.io';
import Client from 'socket.io-client';

describe('Auction WebSocket', () => {
  let io, serverSocket, clientSocket;

  beforeAll((done) => {
    const httpServer = createServer();
    io = new Server(httpServer);
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = new Client(`http://localhost:${port}`);
      io.on('connection', (socket) => {
        serverSocket = socket;
      });
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.close();
  });

  test('should join auction room', (done) => {
    clientSocket.emit('join_auction', { auctionId: 'test' });
    serverSocket.on('join_auction', (data) => {
      expect(data.auctionId).toBe('test');
      done();
    });
  });
});
```

## Performance Monitoring

### Metrics Collection

**Client-side Metrics**:
```javascript
class PerformanceMonitor {
  constructor(socket) {
    this.socket = socket;
    this.metrics = {
      connectionTime: 0,
      bidLatency: [],
      messageCount: 0,
      errors: 0
    };

    this.setupMonitoring();
  }

  setupMonitoring() {
    const startTime = Date.now();
    
    this.socket.on('connect', () => {
      this.metrics.connectionTime = Date.now() - startTime;
    });

    this.socket.on('bid_placed', (data) => {
      if (data.metadata && data.metadata.clientTimestamp) {
        const latency = Date.now() - data.metadata.clientTimestamp;
        this.metrics.bidLatency.push(latency);
      }
    });

    // Track all incoming messages
    const originalOn = this.socket.on;
    this.socket.on = (event, handler) => {
      return originalOn.call(this.socket, event, (...args) => {
        this.metrics.messageCount++;
        return handler(...args);
      });
    };
  }

  getMetrics() {
    return {
      ...this.metrics,
      avgBidLatency: this.metrics.bidLatency.length > 0 
        ? this.metrics.bidLatency.reduce((a, b) => a + b) / this.metrics.bidLatency.length
        : 0
    };
  }
}
```

**Usage with Monitoring**:
```javascript
const socket = io('wss://api.hashland.com/auction', {
  auth: { token: authToken }
});

const monitor = new PerformanceMonitor(socket);

// Enhanced bid placement with timing
function placeBidWithTiming(auctionId, amount) {
  const bidData = {
    auctionId,
    amount,
    bidType: 'regular',
    metadata: {
      clientTimestamp: Date.now(),
      source: 'web'
    }
  };

  socket.emit('place_bid', bidData);
}

// Report metrics periodically
setInterval(() => {
  const metrics = monitor.getMetrics();
  console.log('WebSocket Performance:', metrics);
  
  // Send to analytics service
  analytics.track('websocket_performance', metrics);
}, 30000);
```

## Security Considerations

### Token Management

**Token Refresh**:
```javascript
class SecureAuctionClient extends AuctionClient {
  constructor(token, refreshTokenFn) {
    super(token);
    this.refreshTokenFn = refreshTokenFn;
  }

  async handleAuthError() {
    try {
      // Refresh token
      const newToken = await this.refreshTokenFn();
      
      // Reconnect with new token
      this.socket.disconnect();
      this.token = newToken;
      this.connect();
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Redirect to login
      window.location.href = '/login';
    }
  }
}
```

### Input Validation

**Client-side Validation**:
```javascript
function validateBidData(bidData) {
  const errors = [];

  if (!bidData.auctionId || typeof bidData.auctionId !== 'string') {
    errors.push('Invalid auction ID');
  }

  if (!bidData.amount || typeof bidData.amount !== 'number' || bidData.amount <= 0) {
    errors.push('Invalid bid amount');
  }

  if (bidData.bidType && !['regular', 'buy_now'].includes(bidData.bidType)) {
    errors.push('Invalid bid type');
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }

  return true;
}

// Use validation before emitting
function placeBid(auctionId, amount, bidType = 'regular') {
  const bidData = { auctionId, amount, bidType };
  
  try {
    validateBidData(bidData);
    socket.emit('place_bid', bidData);
  } catch (error) {
    console.error('Bid validation failed:', error.message);
    showError(error.message);
  }
}
```

---

## Troubleshooting

### Common Issues

**Connection Problems**:
1. **Token Expired**: Refresh authentication token
2. **Network Issues**: Check internet connectivity
3. **Server Maintenance**: Wait for service restoration
4. **Rate Limiting**: Reduce request frequency

**Bidding Issues**:
1. **Not Whitelisted**: Join auction whitelist first
2. **Insufficient Balance**: Add more HASH to account
3. **Bid Too Low**: Check minimum bid requirements
4. **Auction Ended**: Auction no longer accepting bids

**Performance Issues**:
1. **High Latency**: Check network connection
2. **Connection Drops**: Enable auto-reconnection
3. **Memory Leaks**: Properly cleanup event listeners

### Debug Mode

**Enable Debug Logging**:
```javascript
localStorage.debug = 'socket.io-client:socket';

const socket = io('wss://api.hashland.com/auction', {
  auth: { token: authToken },
  forceNew: true
});
```

**Custom Debug Logger**:
```javascript
class DebugLogger {
  constructor(socket) {
    this.socket = socket;
    this.logs = [];
    this.setupLogging();
  }

  setupLogging() {
    // Log all events
    const originalEmit = this.socket.emit;
    this.socket.emit = (...args) => {
      this.log('EMIT', args);
      return originalEmit.apply(this.socket, args);
    };

    const originalOn = this.socket.on;
    this.socket.on = (event, handler) => {
      return originalOn.call(this.socket, event, (...args) => {
        this.log('RECEIVE', [event, ...args]);
        return handler(...args);
      });
    };
  }

  log(type, data) {
    const entry = {
      timestamp: new Date().toISOString(),
      type,
      data
    };
    this.logs.push(entry);
    console.log(`[${type}]`, data);
  }

  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }
}
```

For additional support, refer to the [API Documentation](./api.md) and [User Guide](./user-guide.md).