import { Types } from 'mongoose';

/**
 * Enum defining notification types
 */
export enum NotificationType {
  // System Notifications
  SYSTEM_ALERT = 'system_alert',
  MAINTENANCE = 'maintenance',
  UPDATE = 'update',
  SECURITY = 'security',

  // User Action Notifications
  AUCTION_BID = 'auction_bid',
  AUCTION_WHITELIST = 'auction_whitelist',
  TRANSACTION = 'transaction',
  ACHIEVEMENT = 'achievement',
  REFERRAL = 'referral',

  // Custom Notifications
  CUSTOM = 'custom',
  PROMOTIONAL = 'promotional',
  SOCIAL = 'social',
}

/**
 * Enum defining notification priority levels
 */
export enum NotificationPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * Enum defining notification delivery status
 */
export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

/**
 * Enum defining notification content types
 */
export enum NotificationContentType {
  TEXT = 'text',
  RICH = 'rich',
  ACTION = 'action',
  TEMPLATE = 'template',
}

/**
 * Enum defining notification channels
 */
export enum NotificationChannel {
  IN_APP = 'in_app',
  WEBSOCKET = 'websocket',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
}

/**
 * Interface for notification actions
 */
export interface NotificationAction {
  id: string;
  label: string;
  type: 'button' | 'link' | 'dismiss';
  url?: string;
  action?: string;
  style?: 'primary' | 'secondary' | 'danger' | 'success';
}

/**
 * Interface for notification content data
 */
export interface NotificationContentData {
  title: string;
  message: string;
  metadata?: Record<string, any>;
  actions?: NotificationAction[];
  template?: {
    templateId: string;
    variables: Record<string, any>;
  };
  imageUrl?: string;
  iconUrl?: string;
}

/**
 * Interface for notification content
 */
export interface NotificationContent {
  type: NotificationContentType;
  data: NotificationContentData;
}

/**
 * Interface for notification delivery tracking
 */
export interface NotificationDelivery {
  channel: NotificationChannel;
  status: NotificationStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failureReason?: string;
  retryCount: number;
}

/**
 * Interface for notification targeting
 */
export interface NotificationTarget {
  userIds?: Types.ObjectId[];
  roles?: string[];
  criteria?: {
    level?: { min?: number; max?: number };
    registeredAfter?: Date;
    lastActiveAfter?: Date;
    hasCompletedActions?: string[];
    metadata?: Record<string, any>;
  };
}

/**
 * Interface for notification scheduling
 */
export interface NotificationSchedule {
  scheduledFor?: Date;
  timezone?: string;
  recurring?: {
    pattern: 'daily' | 'weekly' | 'monthly';
    interval: number;
    endDate?: Date;
  };
}

/**
 * Interface for template variable context
 */
export interface TemplateContext {
  user?: {
    id: string;
    name: string;
    email?: string;
    level?: number;
    [key: string]: any;
  };
  system?: {
    appName: string;
    timestamp: Date;
    version?: string;
    [key: string]: any;
  };
  custom?: Record<string, any>;
}

/**
 * Interface for notification analytics data
 */
export interface NotificationAnalytics {
  impressions: number;
  clicks: number;
  conversions: number;
  clickThroughRate: number;
  conversionRate: number;
  engagementScore: number;
}
