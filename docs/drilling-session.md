# Redis-Based Drilling Session System

## Overview
The drilling session system manages the lifecycle of operator drilling activities in Hashland. It uses Redis as the primary storage for active sessions to handle high-concurrency operations, with MongoDB as a backup for historical records.

## Session Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   WAITING   │────▶│   ACTIVE    │────▶│  STOPPING   │────▶│  COMPLETED  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                    │                   │                   │
      │                    │                   │                   │
      ▼                    ▼                   ▼                   ▼
 Created when        Activated at        Initiated when      Completed at
operator starts     start of cycle     operator requests    end of cycle
   drilling                              to stop drilling
```

1. **WAITING**: Initial state when a session is created
   - Created when an operator starts drilling
   - Waits for the next drilling cycle to begin
   - No HASH rewards are earned in this state

2. **ACTIVE**: State when a session is actively drilling
   - Activated at the start of a new drilling cycle
   - Earns HASH rewards based on operator efficiency
   - Consumes fuel at each cycle

3. **STOPPING**: State when a session is being stopped
   - Initiated when an operator requests to stop drilling
   - Continues until the end of the current cycle
   - Still earns HASH rewards until the cycle ends

4. **COMPLETED**: Final state when a session is finished
   - Session data is stored in MongoDB for historical records
   - Session is removed from Redis
   - Total earned HASH is added to operator's balance

## Special Cases

### Force Stopping
In some cases, sessions can be force-stopped immediately:
- When an operator runs out of fuel
- When an operator disconnects
- When an admin force-stops a session

In these cases, the session bypasses the STOPPING state and goes directly to COMPLETED.

## Redis Data Structure

### Session Data
Each drilling session is stored in Redis with the key `drilling:session:{operatorId}` and contains:

```json
{
  "operatorId": "string",
  "startTime": "ISO date string",
  "endTime": "ISO date string or null",
  "earnedHASH": number,
  "status": "WAITING | ACTIVE | STOPPING | COMPLETED",
  "cycleStarted": number or null,
  "cycleEnded": number or null
}
```

### Counters
Redis also maintains counters for each session state:
- `drilling:activeSessionsCount`: Number of ACTIVE sessions
- `drilling:waitingSessionsCount`: Number of WAITING sessions
- `drilling:stoppingSessionsCount`: Number of STOPPING sessions

## MongoDB Storage
All sessions are also stored in MongoDB for historical records and persistence. The MongoDB schema includes:
- `operatorId`: Reference to the operator
- `startTime`: When the session started
- `endTime`: When the session ended (null if active)
- `earnedHASH`: Amount of HASH earned during the session

## Integration with Drilling Cycles

### Cycle Start
When a new drilling cycle starts:
1. All WAITING sessions are activated (status changes to ACTIVE)
2. The `cycleStarted` field is set to the current cycle number
3. Operators are notified via WebSocket that their sessions are now active

### Cycle End
When a drilling cycle ends:
1. All STOPPING sessions are completed (status changes to COMPLETED)
2. Session data is stored in MongoDB
3. Sessions are removed from Redis
4. Operators are notified via WebSocket that their sessions are completed
5. Earned HASH is added to operators' balances

## WebSocket Notifications
The system sends real-time notifications to clients at each stage of the session lifecycle:

1. **drilling-started**: When a session is created (WAITING)
2. **drilling-activated**: When a session becomes active (ACTIVE)
3. **drilling-stopping**: When a session is being stopped (STOPPING)
4. **drilling-completed**: When a session is completed (COMPLETED)
5. **drilling-stopped**: When a session is force-stopped

## Performance Considerations

### Redis vs MongoDB
- Redis is used for active sessions due to its high performance for read/write operations
- MongoDB is used for historical records and persistence
- This hybrid approach provides both performance and data integrity

### Batch Operations
The system uses batch operations whenever possible:
- Activating multiple sessions at once at the start of a cycle
- Completing multiple sessions at once at the end of a cycle
- Updating HASH rewards for multiple operators in a single operation

### Redis Key Design
- Session keys are prefixed with `drilling:session:` for easy scanning
- Counters use simple keys for fast atomic operations
- This design allows for efficient key scanning and batch operations

## Error Handling
The system includes robust error handling:
- All Redis operations are wrapped in try/catch blocks
- Failed operations are logged with detailed error messages
- MongoDB operations are retried if they fail
- WebSocket clients are notified of errors

## API

### DrillingSessionService Methods

#### `startDrillingSession(operatorId: Types.ObjectId): Promise<ApiResponse<null>>`
Creates a new drilling session in WAITING status.

#### `activateWaitingSessionsForNewCycle(cycleNumber: number): Promise<{ count: number; operatorIds: Types.ObjectId[] }>`
Activates all waiting sessions at the start of a new cycle.

#### `initiateStopDrillingSession(operatorId: Types.ObjectId, cycleNumber: number): Promise<ApiResponse<null>>`
Initiates stopping a drilling session (changes status to STOPPING).

#### `completeStoppingSessionsForEndCycle(cycleNumber: number): Promise<{ count: number; operatorIds: Types.ObjectId[]; earnedHASH: Map<string, number> }>`
Completes all stopping sessions at the end of a cycle.

#### `forceEndDrillingSession(operatorId: Types.ObjectId, cycleNumber: number): Promise<ApiResponse<null>>`
Immediately ends a drilling session (for emergency stops or fuel depletion).

#### `updateSessionEarnedHash(operatorId: Types.ObjectId, earnedHASH: number): Promise<boolean>`
Updates the earned HASH for an active drilling session.

#### `fetchActiveDrillingSessionsCount(): Promise<number>`
Fetches the total number of active drilling sessions.

#### `fetchWaitingDrillingSessionsCount(): Promise<number>`
Fetches the total number of waiting drilling sessions.

#### `fetchStoppingDrillingSessionsCount(): Promise<number>`
Fetches the total number of stopping drilling sessions.

#### `fetchActiveDrillingSessionsRedis(): Promise<number>`
Fetches the total number of active drilling sessions (both waiting and active).

#### `fetchActiveDrillingSessionOperatorIds(): Promise<Types.ObjectId[]>`
Fetches the operator IDs from all active drilling sessions.

#### `getOperatorSession(operatorId: Types.ObjectId): Promise<RedisDrillingSession | null>`
Gets the current drilling session for an operator. 