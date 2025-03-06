import { Types } from 'mongoose';

/**
 * Types of notifications that can be sent through the system
 */
export enum NotificationType {
  SYSTEM = 'system',
  DRILLING = 'drilling',
  ALERT = 'alert',
  INFO = 'info',
  SUCCESS = 'success',
}

/**
 * Base notification payload structure
 */
export interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  timestamp?: Date;
}

/**
 * Complete notification object with operator information
 */
export interface OperatorNotification extends NotificationPayload {
  id: string;
  operatorId: Types.ObjectId;
  read: boolean;
  timestamp: Date;
}

/**
 * Operator connection information
 */
export interface OperatorConnection {
  socketId: string;
  operatorId: Types.ObjectId;
  connectedAt: Date;
  drillingSessionId?: Types.ObjectId;
  isActive?: boolean;
}

/**
 * Drilling session information
 */
export interface DrillSession {
  sessionId: Types.ObjectId;
  operatorId: Types.ObjectId;
  startTime: Date;
  earnedHASH: number;
}
