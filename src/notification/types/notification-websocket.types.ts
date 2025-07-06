import { Types } from 'mongoose';
import {
  NotificationType,
  NotificationPriority,
  NotificationStatus,
  NotificationChannel,
} from './notification.types';

/**
 * Types for NotificationGateway WebSocket events
 */

// ==========================================
// Client-to-Server Events (Requests)
// ==========================================

/**
 * Request to mark a notification as read
 */
export interface MarkNotificationReadRequest {
  notificationId: string;
}

/**
 * Request to mark multiple notifications as read
 */
export interface MarkNotificationsReadRequest {
  notificationIds?: string[];
  markAll?: boolean;
  types?: NotificationType[];
  createdBefore?: string; // ISO date string
}

/**
 * Request to delete a notification
 */
export interface DeleteNotificationRequest {
  notificationId: string;
}

/**
 * Request to get unread notification count
 */
export interface GetUnreadCountRequest {
  types?: NotificationType[];
  minPriority?: NotificationPriority;
  groupByType?: boolean;
  groupByPriority?: boolean;
}

/**
 * Request to track notification action click
 */
export interface TrackNotificationActionRequest {
  notificationId: string;
  actionId: string;
  actionType: 'click' | 'conversion';
}

/**
 * Request to update user notification preferences
 */
export interface UpdatePreferencesRequest {
  enabled?: boolean;
  types?: {
    type: NotificationType;
    enabled: boolean;
    channels?: NotificationChannel[];
  }[];
  quietHours?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone?: string;
    overrideForCritical: boolean;
  };
}

/**
 * No payload required for get-preferences event
 */
export type GetPreferencesRequest = void;

// ==========================================
// Server-to-Client Events (Responses)
// ==========================================

/**
 * Response for notification event (new notification received)
 */
export interface NotificationReceivedResponse {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  content: {
    type: string;
    data: {
      title: string;
      message: string;
      metadata?: Record<string, any>;
      actions?: Array<{
        id: string;
        label: string;
        type: 'button' | 'link' | 'dismiss';
        url?: string;
        action?: string;
        style?: 'primary' | 'secondary' | 'danger' | 'success';
      }>;
      imageUrl?: string;
      iconUrl?: string;
    };
  };
  senderId?: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  createdAt: string; // ISO date string
  isRead: boolean;
  expiresAt?: string; // ISO date string
}

/**
 * Response for notification-read event
 */
export interface NotificationReadResponse {
  notificationId: string;
  readAt: string; // ISO date string
}

/**
 * Response for notification-deleted event
 */
export interface NotificationDeletedResponse {
  notificationId: string;
}

/**
 * Response for notification-updated event (status change)
 */
export interface NotificationUpdatedResponse {
  notificationId: string;
  status: NotificationStatus;
  channel: NotificationChannel;
  timestamp: string; // ISO date string
}

/**
 * Response for unread-count-updated event
 */
export interface UnreadCountUpdatedResponse {
  total: number;
  byType?: Record<NotificationType, number>;
  byPriority?: Record<NotificationPriority, number>;
}

/**
 * Response for user-preferences-updated event
 */
export interface UserPreferencesUpdatedResponse {
  userId: string;
  preferences: {
    globalSettings: {
      enabled: boolean;
      maxPerDay: number;
      batchDelivery: boolean;
      markAsReadOnView: boolean;
    };
    typePreferences: Array<{
      type: NotificationType;
      enabled: boolean;
      channels: NotificationChannel[];
    }>;
    quietHours: {
      enabled: boolean;
      startTime: string;
      endTime: string;
      timezone: string;
      overrideForCritical: boolean;
    };
  };
}

/**
 * Response for connection-status event
 */
export interface ConnectionStatusResponse {
  connected: boolean;
  userId: string;
  timestamp: string; // ISO date string
}

/**
 * Response for error events
 */
export interface NotificationErrorResponse {
  error: string;
  message: string;
  code?: string;
  details?: any;
}

// ==========================================
// Internal Types
// ==========================================

/**
 * WebSocket client data stored in memory
 */
export interface NotificationClientData {
  userId: Types.ObjectId;
  socketId: string;
  connectedAt: Date;
  lastActivity: Date;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * User room mapping for notifications
 */
export interface UserRoomMapping {
  userId: string;
  socketIds: Set<string>;
  lastActivity: Date;
}

/**
 * Real-time notification delivery tracking
 */
export interface NotificationDeliveryTracking {
  notificationId: Types.ObjectId;
  userId: Types.ObjectId;
  channel: NotificationChannel;
  status: NotificationStatus;
  attempts: number;
  lastAttempt: Date;
  deliveredAt?: Date;
  failureReason?: string;
}

/**
 * WebSocket event for broadcasting notifications
 */
export interface BroadcastNotificationPayload {
  notification: NotificationReceivedResponse;
  targetUserIds: string[];
  priority: NotificationPriority;
  channels: NotificationChannel[];
}

/**
 * Analytics tracking for WebSocket events
 */
export interface NotificationAnalyticsEvent {
  type: 'impression' | 'click' | 'conversion' | 'delivery' | 'read';
  notificationId: Types.ObjectId;
  userId: Types.ObjectId;
  timestamp: Date;
  metadata?: {
    actionId?: string;
    channel?: NotificationChannel;
    deliveryTime?: number;
    userAgent?: string;
  };
}

/**
 * Connection metrics for monitoring
 */
export interface ConnectionMetrics {
  totalConnections: number;
  uniqueUsers: number;
  connectionsPerUser: Record<string, number>;
  averageConnectionTime: number;
  activeRooms: number;
  lastUpdated: Date;
}
