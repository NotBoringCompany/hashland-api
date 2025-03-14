import { Types } from 'mongoose';
import { DrillingSessionStatus } from '../drills/drilling-session.service';

/**
 * Types for DrillingGateway WebSocket events
 */

// ==========================================
// Client-to-Server Events (Requests)
// ==========================================

/**
 * No payload required for start-drilling event
 */
export type StartDrillingRequest = void;

/**
 * No payload required for stop-drilling event
 */
export type StopDrillingRequest = void;

/**
 * No payload required for get-drilling-status event
 */
export type GetDrillingStatusRequest = void;

/**
 * No payload required for get-fuel-status event
 */
export type GetFuelStatusRequest = void;

// ==========================================
// Server-to-Client Events (Responses)
// ==========================================

/**
 * Response for online-operator-update event
 */
export interface OnlineOperatorUpdateResponse {
  onlineOperatorCount: number;
  activeDrillingOperatorCount: number;
}

/**
 * Response for drilling-started event
 */
export interface DrillingStartedResponse {
  message: string;
  status: DrillingSessionStatus.WAITING;
}

/**
 * Response for drilling-info event
 */
export interface DrillingInfoResponse {
  message: string;
}

/**
 * Response for drilling-activated event
 */
export interface DrillingActivatedResponse {
  message: string;
  status: DrillingSessionStatus.ACTIVE;
  cycleNumber: number;
}

/**
 * Response for drilling-stopping event
 */
export interface DrillingStoppingResponse {
  message: string;
  status: DrillingSessionStatus.STOPPING;
}

/**
 * Response for drilling-completed event
 */
export interface DrillingCompletedResponse {
  message: string;
  status: DrillingSessionStatus.COMPLETED;
  cycleNumber: number;
  earnedHASH: number;
}

/**
 * Response for drilling-stopped event
 */
export interface DrillingStoppedResponse {
  message: string;
  reason: 'fuel_depleted' | 'disconnected' | 'admin_stop' | string;
  status: DrillingSessionStatus.COMPLETED;
  operatorId?: string; // Only included in broadcast events
}

/**
 * Response for drilling-status event when a session exists
 */
export interface DrillingStatusActiveResponse {
  status: DrillingSessionStatus;
  startTime: string;
  earnedHASH: number;
  cycleStarted: number | null;
  cycleEnded: number | null;
  currentCycleNumber: number;
}

/**
 * Response for drilling-status event when no session exists
 */
export interface DrillingStatusInactiveResponse {
  status: 'inactive';
  message: string;
}

/**
 * Combined type for drilling-status event response
 */
export type DrillingStatusResponse =
  | DrillingStatusActiveResponse
  | DrillingStatusInactiveResponse;

/**
 * Response for drilling-error event
 */
export interface DrillingErrorResponse {
  message: string;
}

/**
 * Response for drilling-update event
 */
export interface DrillingUpdateResponse {
  currentCycleNumber: number;
  issuedHASH: number;
  activeDrillingOperatorCount: number;
  difficulty?: number;
}

/**
 * Response for fuel-update event
 */
export interface FuelUpdateResponse {
  currentFuel: number;
  maxFuel: number;
  changeAmount: number;
  changeType: 'depleted' | 'replenished';
  message: string;
}

/**
 * Response for fuel-status event
 */
export interface FuelStatusResponse {
  currentFuel: number;
  maxFuel: number;
  fuelPercentage: number;
}

/**
 * Response for cycle-rewards event
 */
export interface CycleRewardsResponse {
  cycleNumber: number;
  extractor: {
    id: string | null;
    name: string | null;
  };
  totalReward: number;
  shares: {
    operatorId: string;
    operatorName: string;
    amount: number;
  }[];
}

// ==========================================
// Internal Types
// ==========================================

/**
 * Structure of a drilling session in Redis
 */
export interface RedisDrillingSession {
  operatorId: string;
  startTime: string; // ISO date string
  endTime: string | null; // ISO date string or null
  earnedHASH: number;
  status: DrillingSessionStatus;
  cycleStarted: number | null; // Cycle number when session became active
  cycleEnded: number | null; // Cycle number when session was stopped
}

/**
 * Payload for broadcasting stop drilling to multiple operators
 */
export interface BroadcastStopDrillingPayload {
  message: string;
  reason: string;
}

/**
 * Result of activating waiting sessions
 */
export interface ActivateSessionsResult {
  count: number;
  operatorIds: Types.ObjectId[];
}

/**
 * Result of completing stopping sessions
 */
export interface CompleteSessionsResult {
  count: number;
  operatorIds: Types.ObjectId[];
  earnedHASH: Map<string, number>;
}
