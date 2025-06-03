# Notification System Module

## Overview

The Notification System module provides a comprehensive, dynamic notification platform with real-time delivery, multi-channel support, and flexible content management. The system supports various notification types including system alerts, user actions, auction updates, and custom events with real-time WebSocket delivery and persistent storage for offline users.

## Key Features

- **Dynamic Content Structure**: Flexible notification schema supporting multiple content types and metadata
- **Real-time Delivery**: WebSocket integration for instant notification delivery
- **Multi-channel Support**: In-app, WebSocket, and future email/SMS channels
- **Template System**: Reusable notification templates with variable substitution
- **User Preferences**: Customizable notification settings per user and notification type
- **Delivery Tracking**: Complete delivery status tracking and analytics
- **Batch Operations**: Efficient bulk notification sending for system-wide announcements
- **Priority System**: Different priority levels for notification ordering and delivery
- **Retention Management**: Configurable notification expiry and cleanup
- **Historical Analytics**: Notification metrics and user engagement tracking

## Notification Types

### System Notifications
- **SYSTEM_ALERT**: Critical system announcements
- **MAINTENANCE**: Scheduled maintenance notifications
- **UPDATE**: Feature updates and releases
- **SECURITY**: Security-related alerts

### User Action Notifications
- **AUCTION_BID**: Bid placed, outbid, or won notifications
- **AUCTION_WHITELIST**: Whitelist status changes
- **TRANSACTION**: HASH currency transactions
- **ACHIEVEMENT**: Milestone and achievement unlocks
- **REFERRAL**: Referral program updates

### Custom Notifications
- **CUSTOM**: Dynamic notifications with flexible content structure
- **PROMOTIONAL**: Marketing and promotional messages
- **SOCIAL**: Social interactions and friend activities

## Dynamic Content Structure

The notification system uses a flexible content structure that supports:

```typescript
interface NotificationContent {
  type: 'text' | 'rich' | 'action' | 'template';
  data: {
    title: string;
    message: string;
    metadata?: Record<string, any>;
    actions?: NotificationAction[];
    template?: {
      templateId: string;
      variables: Record<string, any>;
    };
  };
}
```

## WebSocket Events

### Client → Server Events
- `join_notifications`: Join user's notification room
- `leave_notifications`: Leave notification room
- `mark_read`: Mark notification as read
- `mark_all_read`: Mark all notifications as read
- `get_notifications`: Request notification list with pagination
- `update_preferences`: Update notification preferences

### Server → Client Events
- `new_notification`: New notification received
- `notification_updated`: Notification status changed
- `notifications_marked_read`: Bulk read status update
- `notification_deleted`: Notification removed
- `preference_updated`: User preferences changed

## Template System

### Template Types
- **TEXT**: Simple text-based templates
- **RICH**: Rich content with formatting and media
- **ACTION**: Templates with interactive buttons
- **DYNAMIC**: Templates with complex variable substitution

### Template Variables
- **User Variables**: `{{user.name}}`, `{{user.level}}`, etc.
- **System Variables**: `{{app.name}}`, `{{timestamp}}`, etc.
- **Custom Variables**: Application-specific variables

## API Endpoints Structure

### Notification Management
- `GET /notifications` - Get user notifications with filters and pagination
- `GET /notifications/:id` - Get specific notification details
- `POST /notifications/mark-read` - Mark notifications as read
- `DELETE /notifications/:id` - Delete notification
- `GET /notifications/unread-count` - Get unread notification count

### Admin Notification Management
- `POST /admin/notifications` - Create system notification
- `POST /admin/notifications/broadcast` - Send notification to multiple users
- `GET /admin/notifications/analytics` - Get notification analytics
- `DELETE /admin/notifications/:id` - Delete notification (admin)

### Template Management
- `GET /admin/notification-templates` - List notification templates
- `POST /admin/notification-templates` - Create notification template
- `PUT /admin/notification-templates/:id` - Update notification template
- `DELETE /admin/notification-templates/:id` - Delete notification template

### User Preferences
- `GET /notifications/preferences` - Get user notification preferences
- `PUT /notifications/preferences` - Update user notification preferences
- `POST /notifications/preferences/reset` - Reset to default preferences

### Delivery Analytics
- `GET /admin/notifications/delivery-stats` - Get delivery statistics
- `GET /admin/notifications/engagement` - Get user engagement metrics
- `GET /notifications/history` - Get user's notification history

## Queue System

### Notification Processing Queue
- **CRITICAL**: System alerts and security notifications
- **HIGH**: User action notifications (bids, transactions)
- **MEDIUM**: Achievement and milestone notifications
- **LOW**: Promotional and social notifications
- **Batch Jobs**: Bulk notification processing

## Configuration

### Environment Variables
```env
# Notification Configuration
NOTIFICATION_WEBSOCKET_PORT=3002
NOTIFICATION_MAX_UNREAD=1000
NOTIFICATION_RETENTION_DAYS=90
NOTIFICATION_BATCH_SIZE=100

# Template Configuration
TEMPLATE_CACHE_TTL=3600
TEMPLATE_VALIDATION_ENABLED=true

# Delivery Configuration
DELIVERY_RETRY_ATTEMPTS=3
DELIVERY_TIMEOUT_MS=5000
```

## Security Considerations

1. **Authentication**: All notification endpoints require authenticated users
2. **Authorization**: Proper access control for admin operations and user data
3. **Content Validation**: Strict validation of notification content and templates
4. **Rate Limiting**: Prevent notification spam and abuse
5. **Data Privacy**: Secure handling of user preferences and notification data
6. **WebSocket Security**: Authenticated WebSocket connections with room isolation

## Performance Considerations

1. **Database Indexing**: Optimized indexes for user notifications and timestamps
2. **Queue Processing**: Efficient batch processing for bulk operations
3. **WebSocket Scaling**: Redis adapter support for multi-instance deployments
4. **Template Caching**: Cache compiled templates for performance
5. **Pagination**: Efficient pagination for large notification lists
6. **Background Cleanup**: Automated cleanup of expired notifications

## Dependencies

### Required Packages
- `@nestjs/websockets` - WebSocket support
- `@nestjs/platform-socket.io` - Socket.IO integration
- `socket.io` - Real-time communication
- `@nestjs/bull` - Queue management
- `bull` - Redis-based queue
- `@nestjs/schedule` - Cron job scheduling
- `handlebars` - Template engine for dynamic content

### Existing Dependencies
- `@nestjs/mongoose` - MongoDB integration
- `mongoose` - MongoDB ODM
- `@nestjs/swagger` - API documentation
- `class-validator` - DTO validation
- `class-transformer` - Object transformation

## Todo List

### Phase 1: Core Infrastructure (Week 1)
- [ ] Create notification schema with dynamic content support
- [ ] Implement notification template schema and service
- [ ] Create user notification preferences schema
- [ ] Set up basic notification service with CRUD operations
- [ ] Implement notification repository with indexing
- [ ] Create notification DTOs and validation

### Phase 2: WebSocket Gateway (Week 1)
- [ ] Create notification WebSocket gateway
- [ ] Implement real-time notification delivery
- [ ] Add user room management and authentication
- [ ] Create WebSocket event handlers for notification actions
- [ ] Implement connection management and error handling
- [ ] Add WebSocket middleware for authorization

### Phase 3: Template System (Week 2)
- [ ] Implement template engine with Handlebars
- [ ] Create template validation and compilation service
- [ ] Add variable substitution and rendering
- [ ] Implement template caching mechanism
- [ ] Create admin template management endpoints
- [ ] Add template versioning support

### Phase 4: Queue System (Week 2)
- [ ] Set up Bull queue for notification processing
- [ ] Implement priority-based queue processing
- [ ] Add batch notification processing
- [ ] Create retry logic for failed deliveries
- [ ] Implement delivery status tracking
- [ ] Add queue monitoring and metrics

### Phase 5: API Implementation (Week 3)
- [ ] Create notification controller with all endpoints
- [ ] Implement pagination and filtering for notifications
- [ ] Add admin notification management endpoints
- [ ] Create user preference management
- [ ] Implement notification analytics endpoints
- [ ] Add bulk operations support

### Phase 6: Integration & Services (Week 3)
- [ ] Create notification factory for different types
- [ ] Implement notification dispatcher service
- [ ] Add integration hooks for auction system
- [ ] Create system notification triggers
- [ ] Implement user action notification handlers
- [ ] Add notification aggregation service

### Phase 7: Advanced Features (Week 4)
- [ ] Implement notification scheduling and delayed delivery
- [ ] Add notification expiry and cleanup service
- [ ] Create notification analytics and reporting
- [ ] Implement user engagement tracking
- [ ] Add notification preferences inheritance
- [ ] Create notification search and filtering

### Phase 8: Testing & Documentation (Week 4)
- [ ] Write comprehensive unit tests
- [ ] Create integration tests for WebSocket functionality
- [ ] Add E2E tests for notification flows
- [ ] Write API documentation
- [ ] Create WebSocket event documentation
- [ ] Add deployment and configuration guides

### Phase 9: Performance & Optimization (Week 5)
- [ ] Optimize database queries and indexing
- [ ] Implement notification caching strategies
- [ ] Add queue performance monitoring
- [ ] Optimize WebSocket connection handling
- [ ] Implement notification deduplication
- [ ] Add performance metrics and logging

### Phase 10: Production Readiness (Week 5)
- [ ] Add comprehensive error handling and logging
- [ ] Implement health checks and monitoring
- [ ] Create deployment scripts and configuration
- [ ] Add rate limiting and security measures
- [ ] Implement backup and recovery procedures
- [ ] Create operational runbooks

## Module Structure

```
src/notification/
├── README.md
├── index.ts
├── notification.module.ts
├── notification.module.spec.ts
├── controllers/
│   ├── notification.controller.ts
│   ├── notification-admin.controller.ts
│   └── notification-preference.controller.ts
├── services/
│   ├── notification.service.ts
│   ├── notification-template.service.ts
│   ├── notification-dispatcher.service.ts
│   ├── notification-factory.service.ts
│   └── notification-analytics.service.ts
├── gateways/
│   ├── notification.gateway.ts
│   └── notification.gateway.service.ts
├── schemas/
│   ├── notification.schema.ts
│   ├── notification-template.schema.ts
│   └── notification-preference.schema.ts
├── dto/
│   ├── create-notification.dto.ts
│   ├── update-notification.dto.ts
│   ├── notification-filter.dto.ts
│   ├── notification-preference.dto.ts
│   └── notification-template.dto.ts
├── processors/
│   ├── notification.processor.ts
│   └── notification-batch.processor.ts
├── types/
│   ├── notification.types.ts
│   └── notification-events.types.ts
├── config/
│   └── notification.config.ts
└── filters/
    └── notification.filter.ts
```

## Integration Points

### Existing Systems
- **Auction System**: Bid notifications, whitelist updates, auction status
- **Operator System**: User authentication and profile integration
- **Currency System**: Transaction notifications and balance updates
- **Achievement System**: Milestone and reward notifications
- **Admin System**: System-wide announcements and alerts

### Future Integrations
- **Email Service**: Email notification delivery
- **SMS Service**: SMS notification support
- **Push Notifications**: Mobile app push notifications
- **Analytics Service**: Advanced notification analytics
- **Marketing Service**: Promotional campaign notifications 