import { Types } from 'mongoose';

export interface UserConnection {
    socketId: string;
    userId: Types.ObjectId;
    connectedAt: Date;
}

export interface NotificationPayload {
    type: NotificationType;
    title: string;
    message: string;
    data?: any;
    timestamp: Date;
}

export enum NotificationType {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
    SUCCESS = 'success',
    SYSTEM = 'system',
    DRILLING = 'drilling'
}

export interface UserNotification extends NotificationPayload {
    id: string;
    userId: Types.ObjectId;
    read: boolean;
}