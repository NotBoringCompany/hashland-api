/**
 * Example WebSocket client for auction system
 * This demonstrates how to connect and interact with the auction WebSocket
 */

import { io } from 'socket.io-client';

// Configuration
const SERVER_URL = 'http://localhost:8080';
const JWT_TOKEN = 'your-jwt-token-here';
const AUCTION_ID = '507f1f77bcf86cd799439012';
const OPERATOR_ID = '507f1f77bcf86cd799439013';

// Connect to auction namespace
const socket = io(`${SERVER_URL}/auction`, {
  auth: {
    token: JWT_TOKEN,
    operatorId: OPERATOR_ID,
  },
  transports: ['websocket'],
});

// Connection events
socket.on('connect', () => {
  console.log('✅ Connected to auction WebSocket');
  console.log('Socket ID:', socket.id);
});

socket.on('connection_confirmed', (data) => {
  console.log('🎉 Connection confirmed:', data);

  // Join auction room after connection
  joinAuction();
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from auction WebSocket');
});

socket.on('connect_error', (error) => {
  console.error('🚫 Connection error:', error.message);
});

// Auction events
socket.on('auction_status', (data) => {
  console.log('📊 Auction status:', data.auction);
});

socket.on('new_bid', (data) => {
  console.log('💰 New bid placed:', {
    bidId: data.bid._id,
    amount: data.bid.amount,
    bidder: data.bid.bidderId,
    timestamp: data.timestamp,
  });
});

socket.on('bid_placed', (data) => {
  console.log('✅ Your bid was placed successfully:', data);
});

socket.on('bid_error', (data) => {
  console.error('❌ Bid error:', data.message);
});

socket.on('bid_outbid', (data) => {
  console.log('⚠️ Your bid was outbid:', data);
});

socket.on('user_joined', (data) => {
  console.log('👋 User joined auction:', data.operatorId);
});

socket.on('user_left', (data) => {
  console.log('👋 User left auction:', data.operatorId);
});

socket.on('auction_ending_soon', (data) => {
  console.log(`⏰ Auction ending in ${data.minutesLeft} minutes!`);
});

socket.on('auction_ended', (data) => {
  console.log('🏁 Auction ended:', {
    winner: data.winner,
    finalPrice: data.finalPrice,
  });
});

socket.on('error', (data) => {
  console.error('❌ Error:', data.message);
});

// Helper functions
function joinAuction() {
  console.log(`🚪 Joining auction: ${AUCTION_ID}`);
  socket.emit('join_auction', { auctionId: AUCTION_ID });
}

function leaveAuction() {
  console.log(`🚪 Leaving auction: ${AUCTION_ID}`);
  socket.emit('leave_auction', { auctionId: AUCTION_ID });
}

function placeBid(amount) {
  console.log(`💰 Placing bid: ${amount} HASH`);
  socket.emit('place_bid', {
    bidderId: OPERATOR_ID,
    amount: amount,
    bidType: 'regular',
    metadata: {
      source: 'websocket_client',
      userAgent: 'Node.js Example Client',
    },
  });
}

function getAuctionStatus() {
  console.log('📊 Getting auction status...');
  socket.emit('get_auction_status', { auctionId: AUCTION_ID });
}

// Example usage
setTimeout(() => {
  // Get current auction status
  getAuctionStatus();
}, 2000);

setTimeout(() => {
  // Place a bid
  placeBid(100);
}, 5000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  leaveAuction();
  socket.disconnect();
  process.exit(0);
});

console.log('🚀 Starting auction WebSocket client...');
console.log('Press Ctrl+C to exit');
