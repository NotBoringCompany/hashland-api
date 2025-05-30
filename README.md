<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## Phase 4: Queue System & High-Frequency Handling ✅

### Overview
Implemented a Redis-based queue system using Bull to handle high-frequency bid processing, ensuring system stability during peak auction activity.

### Key Features

#### 🚀 **High-Frequency Bid Processing**
- **Intelligent Queue Detection**: Automatically switches to queue processing for:
  - Auctions ending within 30 minutes
  - Auctions with >50 total bids
  - Buy-now bids (always high priority)
- **Priority-Based Processing**: 
  - Critical: Buy-now bids (immediate processing)
  - High: High-value bids (≥10,000 HASH)
  - Medium: Regular bids
  - Low: Background operations

#### 📊 **Queue Management**
- **Real-time Metrics**: Active, waiting, completed, failed job counts
- **Performance Monitoring**: Average processing time, throughput (jobs/minute)
- **Health Checks**: Automatic issue detection and reporting
- **Admin Controls**: Pause/resume, cleanup, retry failed jobs

#### 🔄 **Conflict Resolution**
- **Retry Logic**: Exponential backoff for transient failures
- **Bid Conflicts**: Automatic retry with updated auction state
- **Concurrency Handling**: Prevents race conditions in high-frequency scenarios
- **Fallback Processing**: Direct processing if queue unavailable

#### 🛡️ **Reliability Features**
- **Job Persistence**: Redis-backed job storage
- **Error Handling**: Comprehensive error classification and handling
- **Dead Letter Queue**: Failed jobs stored for manual review
- **Monitoring**: Detailed logging and metrics collection

### Technical Implementation

#### **Queue Configuration**
```typescript
// Environment-based configuration
REDIS_QUEUE_HOST=localhost
REDIS_QUEUE_PORT=6379
REDIS_QUEUE_DB=1
QUEUE_CONCURRENCY=10
QUEUE_MAX_RETRIES=3
PRIORITY_BUY_NOW=20
PRIORITY_REGULAR=10
```

#### **Queue Processing Flow**
1. **Bid Submission** → Queue detection logic
2. **Job Creation** → Priority assignment and metadata
3. **Queue Processing** → Validation, conflict resolution, execution
4. **Notification** → Real-time updates via WebSocket
5. **Cleanup** → Automatic job cleanup and metrics

#### **API Endpoints**

**Queue Management:**
- `GET /queue/metrics` - Queue performance metrics
- `GET /queue/health` - Queue health status
- `GET /queue/jobs/:jobId` - Job status details
- `POST /queue/jobs/:jobId/retry` - Retry failed job
- `DELETE /queue/jobs/:jobId` - Remove job
- `POST /queue/cleanup` - Clean old jobs
- `POST /queue/pause` - Pause queue processing
- `POST /queue/resume` - Resume queue processing

**Auction Queue Integration:**
- `POST /auctions/:id/bid/queue` - Place bid via queue
- `GET /auctions/:id/queue-status` - Check if auction should use queue

#### **WebSocket Integration**
- **Automatic Detection**: WebSocket bids automatically use queue for high-frequency auctions
- **Real-time Feedback**: Immediate confirmation with job ID for queued bids
- **Status Updates**: Real-time bid processing status via WebSocket events

### Queue System Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Client Bid    │───▶│ Queue Logic  │───▶│  Redis Queue    │
│   (WebSocket/   │    │ (Priority &  │    │  (Bull/Redis)   │
│    REST API)    │    │  Detection)  │    │                 │
└─────────────────┘    └──────────────┘    └─────────────────┘
                                                     │
                                                     ▼
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Real-time     │◀───│ Notification │◀───│  Bid Processor  │
│   Updates       │    │   Service    │    │  (Validation &  │
│  (WebSocket)    │    │              │    │   Execution)    │
└─────────────────┘    └──────────────┘    └─────────────────┘
```

### Performance Benefits

#### **Scalability Improvements**
- **Concurrent Processing**: Up to 10 concurrent bid processors
- **Load Distribution**: Queue-based load balancing
- **Resource Management**: Prevents system overload during peak activity
- **Horizontal Scaling**: Redis cluster support for multi-instance deployment

#### **Reliability Enhancements**
- **Fault Tolerance**: Automatic retry with exponential backoff
- **Data Consistency**: Conflict resolution prevents race conditions
- **System Stability**: Queue prevents direct database overload
- **Monitoring**: Comprehensive metrics for performance optimization

### Usage Examples

#### **High-Frequency Scenario**
```typescript
// Auction ending in 15 minutes with 75 bids
// Automatically uses queue processing

const result = await auctionService.placeBidQueued(
  auctionId,
  bidderId,
  amount,
  BidType.REGULAR,
  metadata
);
// Returns: { jobId: "12345", message: "Bid queued for processing" }
```

#### **Queue Monitoring**
```typescript
// Get queue health status
const health = await queueService.getQueueHealth();
// Returns: { isHealthy: true, metrics: {...}, issues: [] }

// Get specific job status
const jobStatus = await queueService.getJobStatus("12345");
// Returns: { id: "12345", state: "completed", progress: 100, ... }
```

### Environment Variables

```bash
# Redis Configuration
REDIS_QUEUE_HOST=localhost
REDIS_QUEUE_PORT=6379
REDIS_QUEUE_PASSWORD=your_redis_password
REDIS_QUEUE_DB=1

# Queue Processing
QUEUE_CONCURRENCY=10
QUEUE_MAX_RETRIES=3
QUEUE_RETRY_DELAY=5000
QUEUE_JOB_TIMEOUT=30000

# Job Cleanup
QUEUE_REMOVE_ON_COMPLETE=100
QUEUE_REMOVE_ON_FAIL=50

# Priority Levels
PRIORITY_BUY_NOW=20
PRIORITY_ENDING_SOON=15
PRIORITY_REGULAR=10
PRIORITY_LOW=5
```

### Monitoring & Maintenance

#### **Queue Health Monitoring**
- **Metrics Dashboard**: Real-time queue performance metrics
- **Alert System**: Automatic alerts for queue issues
- **Performance Tracking**: Historical performance data
- **Capacity Planning**: Queue utilization trends

#### **Maintenance Operations**
- **Job Cleanup**: Automatic cleanup of old completed/failed jobs
- **Queue Pause/Resume**: Maintenance mode support
- **Failed Job Recovery**: Manual retry of failed jobs
- **Performance Tuning**: Configurable concurrency and timeouts

---

## Phase 5: Auction Lifecycle & State Management ✅

### Overview
Implemented automated auction lifecycle management with scheduled state transitions, real-time notifications, and comprehensive lifecycle monitoring.

### Key Features

#### 🔄 **Automated State Transitions**
- **Scheduled Processing**: Cron job runs every minute to check for state transitions
- **Whitelist Management**: Automatic opening/closing of whitelist registration
- **Auction Lifecycle**: Automated start/end of auction bidding periods
- **Status Validation**: Comprehensive validation before each state transition

#### ⏰ **Lifecycle Events**
- **Whitelist Opened**: Automatic transition from DRAFT to WHITELIST_OPEN
- **Whitelist Closed**: Transition from WHITELIST_OPEN to WHITELIST_CLOSED
- **Auction Started**: Transition from WHITELIST_CLOSED to AUCTION_ACTIVE
- **Auction Ended**: Transition from AUCTION_ACTIVE to ENDED
- **NFT Status Updates**: Automatic NFT status updates (ACTIVE → IN_AUCTION → SOLD)

#### 📊 **State Management**
- **Timeline Tracking**: Complete auction lifecycle timeline with timestamps
- **Progress Monitoring**: Real-time progress tracking for each auction
- **Manual Triggers**: Admin ability to manually trigger state transitions
- **Rollback Prevention**: Prevents invalid state transitions

#### 🔔 **Real-time Notifications**
- **WebSocket Integration**: Real-time updates for all lifecycle events
- **Ending Warnings**: Automatic warnings at 30, 15, 5, and 1 minutes before end
- **Status Broadcasts**: Live status updates to all connected clients
- **Event History**: Complete audit trail of all lifecycle events

### Technical Implementation

#### **Automated Processing**
```typescript
// Cron job runs every minute
@Cron(CronExpression.EVERY_MINUTE)
async processAuctionLifecycle(): Promise<void> {
  await Promise.all([
    this.openWhitelists(),
    this.closeWhitelists(), 
    this.startAuctions(),
    this.endAuctions(),
    this.sendEndingWarnings(),
  ]);
}
```

#### **State Transition Logic**
```typescript
// Automatic state transitions based on time
const now = new Date();

// Open whitelist
if (auction.status === DRAFT && 
    now >= auction.whitelistConfig.startTime) {
  await this.transitionToWhitelistOpen(auction);
}

// Start auction
if (auction.status === WHITELIST_CLOSED && 
    now >= auction.auctionConfig.startTime) {
  await this.transitionToAuctionActive(auction);
}
```

#### **API Endpoints**

**Lifecycle Management:**
- `GET /auctions/:id/lifecycle` - Get auction lifecycle status and timeline
- `POST /auctions/:id/lifecycle/trigger` - Manually trigger state transition
- `GET /auctions/lifecycle/status` - Get lifecycle processing system status

**Lifecycle Status Response:**
```json
{
  "currentStatus": "WHITELIST_OPEN",
  "nextTransition": {
    "status": "WHITELIST_CLOSED",
    "scheduledTime": "2024-03-19T18:00:00.000Z",
    "timeUntil": 3600000
  },
  "timeline": [
    {
      "status": "DRAFT",
      "time": "2024-03-19T10:00:00.000Z",
      "completed": true
    },
    {
      "status": "WHITELIST_OPEN", 
      "time": "2024-03-19T12:00:00.000Z",
      "completed": true
    },
    {
      "status": "WHITELIST_CLOSED",
      "time": "2024-03-19T18:00:00.000Z", 
      "completed": false
    }
  ]
}
```

### Auction Status Flow

```
┌─────────────┐    ┌──────────────────┐    ┌───────────────────┐
│    DRAFT    │───▶│ WHITELIST_OPEN   │───▶│ WHITELIST_CLOSED  │
│  (Created)  │    │ (Registration)   │    │  (Preparation)    │
└─────────────┘    └──────────────────┘    └───────────────────┘
                                                      │
                                                      ▼
┌─────────────┐                                ┌──────────────────┐
│    ENDED    │◀───────────────────────────────│ AUCTION_ACTIVE   │
│ (Finished)  │                                │   (Bidding)      │
└─────────────┘                                └──────────────────┘
```

### Lifecycle Events & Notifications

#### **Event Types**
- `whitelist_opened` - Whitelist registration begins
- `whitelist_closed` - Whitelist registration ends
- `auction_started` - Bidding period begins
- `auction_ending_soon` - Warning notifications (30, 15, 5, 1 min)
- `auction_ended` - Auction completed

#### **WebSocket Events**
```typescript
// Client receives real-time lifecycle updates
socket.on('auction_updated', (data) => {
  console.log('Lifecycle event:', data.type);
  console.log('New status:', data.auction.status);
});

// Ending warnings
socket.on('auction_ending_soon', (data) => {
  console.log(`Auction ending in ${data.minutesLeft} minutes`);
});
```

### Automated Features

#### **Smart Scheduling**
- **Time-based Triggers**: Automatic transitions based on configured times
- **Validation Checks**: Comprehensive validation before each transition
- **Error Handling**: Graceful error handling with detailed logging
- **Recovery Logic**: Automatic retry for failed transitions

#### **NFT Status Synchronization**
- **ACTIVE** → **IN_AUCTION** (when auction starts)
- **IN_AUCTION** → **SOLD** (when auction ends with winner)
- **IN_AUCTION** → **ACTIVE** (when auction ends without winner)

#### **Notification System**
- **Real-time Updates**: WebSocket broadcasts for all lifecycle events
- **Targeted Notifications**: Specific notifications for different user groups
- **Warning System**: Progressive warnings as auctions approach end time
- **History Tracking**: Complete audit trail of all lifecycle events

### Configuration & Monitoring

#### **Cron Job Configuration**
```typescript
// Runs every minute for precise timing
@Cron(CronExpression.EVERY_MINUTE)
async processAuctionLifecycle(): Promise<void>

// Custom intervals can be configured:
// @Cron('*/30 * * * * *') // Every 30 seconds
// @Cron('0 */5 * * * *')  // Every 5 minutes
```

#### **Monitoring & Debugging**
- **Processing Status**: Real-time status of lifecycle processing
- **Event Logging**: Detailed logs for all state transitions
- **Error Tracking**: Comprehensive error logging and reporting
- **Performance Metrics**: Processing time and success rate tracking

#### **Manual Controls**
- **Trigger Transitions**: Admin can manually trigger state transitions
- **Status Monitoring**: Real-time monitoring of all auction lifecycles
- **Timeline Visualization**: Complete timeline view for each auction
- **Event History**: Detailed history of all lifecycle events

### Usage Examples

#### **Monitoring Auction Lifecycle**
```typescript
// Get current lifecycle status
const status = await auctionService.getLifecycleStatus(auctionId);
console.log('Current status:', status.currentStatus);
console.log('Next transition in:', status.nextTransition?.timeUntil, 'ms');

// Manually trigger transition (admin only)
const result = await lifecycleService.triggerStateTransition(auctionId);
console.log('Transition result:', result.message);
```

#### **Real-time Lifecycle Monitoring**
```typescript
// WebSocket client monitoring
socket.on('auction_updated', (data) => {
  if (data.type === 'whitelist_opened') {
    showNotification('Whitelist is now open!');
  } else if (data.type === 'auction_started') {
    showNotification('Auction has started - place your bids!');
  }
});

socket.on('auction_ending_soon', (data) => {
  showWarning(`Auction ending in ${data.minutesLeft} minutes!`);
});
```

### Performance & Reliability

#### **Efficient Processing**
- **Batch Operations**: Process multiple auctions simultaneously
- **Optimized Queries**: Efficient database queries for state checking
- **Minimal Overhead**: Lightweight cron job with minimal resource usage
- **Scalable Design**: Handles large numbers of concurrent auctions

#### **Error Handling**
- **Graceful Failures**: Individual auction failures don't affect others
- **Retry Logic**: Automatic retry for transient failures
- **Detailed Logging**: Comprehensive error logging for debugging
- **Monitoring Alerts**: System alerts for critical failures

#### **Data Consistency**
- **Atomic Operations**: State transitions are atomic and consistent
- **Validation Checks**: Comprehensive validation before each transition
- **Audit Trail**: Complete history of all state changes
- **Rollback Prevention**: Prevents invalid or duplicate transitions

---
