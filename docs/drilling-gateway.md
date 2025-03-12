# Drilling Gateway Documentation

## Overview
The Drilling Gateway provides real-time WebSocket communication for the drilling functionality in the Hashland API. It handles operator connections, drilling sessions, and broadcasts real-time updates to connected clients.

## Session Lifecycle
Drilling sessions follow a specific lifecycle:

1. **WAITING**: When a session is first created, it enters a waiting state until the next drilling cycle begins
2. **ACTIVE**: When a new drilling cycle begins, all waiting sessions are activated
3. **STOPPING**: When a user requests to stop drilling, the session enters a stopping state until the current cycle ends
4. **COMPLETED**: At the end of a cycle, all stopping sessions are completed and removed from Redis

## Authentication
The gateway uses JWT authentication. Clients must include a valid JWT token in the authorization header when connecting.

## Available Events

### Client-to-Server Events
1. **start-drilling**: Request to start a new drilling session
   - No parameters required

2. **stop-drilling**: Request to stop an active drilling session
   - No parameters required

3. **get-drilling-status**: Request the current status of the operator's drilling session
   - No parameters required

### Server-to-Client Events
1. **online-operator-update**: Broadcasts when operators connect/disconnect
   - `onlineOperatorCount`: Number of online operators
   - `activeDrillingOperatorCount`: Number of actively drilling operators

2. **drilling-started**: Sent when drilling starts successfully
   - `message`: Success message
   - `status`: Session status (WAITING)

3. **drilling-info**: Sent with additional information about the drilling session
   - `message`: Informational message

4. **drilling-activated**: Sent when a session is activated at the start of a new cycle
   - `message`: Success message
   - `status`: Session status (ACTIVE)
   - `cycleNumber`: The cycle number when the session was activated

5. **drilling-stopping**: Sent when a stop request is initiated
   - `message`: Status message
   - `status`: Session status (STOPPING)

6. **drilling-completed**: Sent when a session is completed at the end of a cycle
   - `message`: Success message
   - `status`: Session status (COMPLETED)
   - `cycleNumber`: The cycle number when the session was completed
   - `earnedHASH`: Amount of HASH earned during the session

7. **drilling-stopped**: Sent when a session is force-stopped (e.g., due to fuel depletion)
   - `message`: Status message
   - `reason`: Reason for stopping (e.g., 'fuel_depleted')
   - `status`: Session status (COMPLETED)

8. **drilling-status**: Sent in response to a get-drilling-status request
   - `status`: Current session status (WAITING, ACTIVE, STOPPING, or 'inactive')
   - `startTime`: When the session started (ISO date string)
   - `earnedHASH`: Current amount of HASH earned
   - `cycleStarted`: Cycle number when the session was activated
   - `cycleEnded`: Cycle number when the session was stopped (if stopping)
   - `currentCycleNumber`: The current cycle number
   - `message`: Only present if status is 'inactive'

9. **drilling-error**: Sent when an error occurs
   - `message`: Error message

## Usage Example

```javascript
// Connect to the WebSocket server with authentication
const socket = io('https://api.hashland.com', {
  extraHeaders: {
    Authorization: `Bearer ${jwtToken}`
  }
});

// Connection events
socket.on('connect', () => console.log('Connected to WebSocket server'));
socket.on('disconnect', () => console.log('Disconnected from WebSocket server'));

// Request current drilling status
socket.emit('get-drilling-status');

// Listen for drilling status response
socket.on('drilling-status', (data) => {
  console.log('Current drilling status:', data.status);
  if (data.status !== 'inactive') {
    console.log('Earned HASH:', data.earnedHASH);
    console.log('Current cycle:', data.currentCycleNumber);
  }
});

// Start drilling
socket.emit('start-drilling');

// Listen for drilling events
socket.on('drilling-started', (data) => console.log('Drilling started:', data));
socket.on('drilling-activated', (data) => console.log('Drilling activated:', data));
socket.on('drilling-stopping', (data) => console.log('Drilling stopping:', data));
socket.on('drilling-completed', (data) => console.log('Drilling completed:', data));
socket.on('drilling-stopped', (data) => console.log('Drilling stopped:', data));
socket.on('drilling-error', (data) => console.error('Drilling error:', data.message));

// Stop drilling
socket.emit('stop-drilling');
```

## Key Features
- JWT authentication for secure connections
- Automatic session termination on disconnection
- Fuel monitoring with automatic drilling stoppage
- Redis persistence for operator status and session data
- Real-time stats broadcasting
- Cycle-based session activation and completion

## Redis Storage
The gateway uses Redis to persist operator status and session data:
- `drilling:onlineOperators`: Stores the list of online operators
- `drilling:activeDrillingOperators`: Stores the mapping of actively drilling operators to their socket IDs
- `drilling:activeSessionsCount`: Counts active drilling sessions
- `drilling:waitingSessionsCount`: Counts waiting drilling sessions
- `drilling:stoppingSessionsCount`: Counts stopping drilling sessions
- `drilling:session:{operatorId}`: Stores the session data for each operator

## Session Data Structure
Each drilling session in Redis contains:
- `operatorId`: The ID of the operator
- `startTime`: When the session started
- `endTime`: When the session ended (null if active)
- `earnedHASH`: Amount of HASH earned during the session
- `status`: Current status (WAITING, ACTIVE, STOPPING, COMPLETED)
- `cycleStarted`: The cycle number when the session became active
- `cycleEnded`: The cycle number when the session was marked for stopping

## Cycle Integration
- Sessions are activated in batch at the start of each cycle
- Sessions are completed in batch at the end of each cycle
- HASH rewards are distributed only to active sessions

## Error Handling
The gateway handles various error scenarios including:
- Authentication failures
- Insufficient fuel
- Connection issues
- Session management errors

All errors are logged server-side and relevant errors are sent to clients via the `drilling-error` event.

## Automatic Fuel Monitoring
The system automatically stops drilling when an operator's fuel drops below the threshold defined in `GAME_CONSTANTS.FUEL.BASE_FUEL_DEPLETION_RATE.maxUnits`.

## Disconnection Handling
When an operator disconnects, the system:
1. Automatically ends any active drilling session
2. Updates Redis to reflect the operator's offline status
3. Broadcasts updated stats to all connected clients 