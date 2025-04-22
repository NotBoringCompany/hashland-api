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
The gateway uses JWT authentication for operator-specific functionality. Clients must include a valid JWT token in the auth object when connecting for authenticated features. However, certain features are accessible without authentication (see Public Events section below).

## Public Events
The following events are accessible without authentication:

1. **get-latest-cycle**: Request the latest 5 cycle data (rewards will only be included if authenticated)
2. **latest-cycle**: Receive the latest cycle data in response to get-latest-cycle
3. **new-cycle**: Receive broadcasts when a new drilling cycle is created
4. **online-operator-update**: Receive updates about online operator counts
5. **drilling-update**: Receive real-time drilling information updates

These events allow public clients to access basic cycle and drilling information without requiring authentication.

## Available Events

### Client-to-Server Events
1. **start-drilling**: Request to start a new drilling session
   - No parameters required
   - *Requires authentication*

2. **stop-drilling**: Request to stop an active drilling session
   - No parameters required
   - *Requires authentication*

3. **get-drilling-status**: Request the current status of the operator's drilling session
   - No parameters required
   - *Requires authentication*

4. **get-fuel-status**: Request the current fuel status of the operator
   - No parameters required
   - *Requires authentication*

5. **get-latest-cycle**: Request the latest 5 cycle rewards
   - No parameters required
   - *Public access available*

### Server-to-Client Events
1. **online-operator-update**: Broadcasts when operators connect/disconnect
   - `onlineOperatorCount`: Number of online operators
   - `activeDrillingOperatorCount`: Number of actively drilling operators
   - *Public access available*

2. **drilling-started**: Sent when drilling starts successfully
   - `message`: Success message
   - `status`: Session status (WAITING)
   - *Requires authentication*

3. **drilling-info**: Sent with additional information about the drilling session
   - `message`: Informational message
   - *Requires authentication*

4. **drilling-activated**: Sent when a session is activated at the start of a new cycle
   - `message`: Success message
   - `status`: Session status (ACTIVE)
   - `cycleNumber`: The cycle number when the session was activated
   - *Requires authentication*

5. **drilling-stopping**: Sent when a stop request is initiated
   - `message`: Status message
   - `status`: Session status (STOPPING)
   - *Requires authentication*

6. **drilling-completed**: Sent when a session is completed at the end of a cycle
   - `message`: Success message
   - `status`: Session status (COMPLETED)
   - `cycleNumber`: The cycle number when the session was completed
   - `earnedHASH`: Amount of HASH earned during the session
   - *Requires authentication*

7. **drilling-stopped**: Sent when a session is force-stopped (e.g., due to fuel depletion)
   - `message`: Status message
   - `reason`: Reason for stopping (e.g., 'fuel_depleted')
   - `status`: Session status (COMPLETED)
   - `operatorId`: ID of the operator whose session was stopped (only in broadcast messages)
   - *Requires authentication*

8. **drilling-status**: Sent in response to a get-drilling-status request
   - `status`: Current session status (WAITING, ACTIVE, STOPPING, or 'inactive')
   - `startTime`: When the session started (ISO date string)
   - `earnedHASH`: Current amount of HASH earned
   - `cycleStarted`: Cycle number when the session was activated
   - `cycleEnded`: Cycle number when the session was stopped (if stopping)
   - `currentCycleNumber`: The current cycle number
   - `message`: Only present if status is 'inactive'
   - *Requires authentication*

9. **drilling-error**: Sent when an error occurs
   - `message`: Error message
   - *May be sent to authenticated or unauthenticated clients*

10. **fuel-update**: Sent when an operator's fuel is depleted or replenished
    - `currentFuel`: Current fuel level
    - `maxFuel`: Maximum fuel capacity
    - `changeAmount`: Amount of fuel changed
    - `changeType`: Type of change ('depleted' or 'replenished')
    - `message`: Descriptive message about the fuel change
    - *Requires authentication*

11. **fuel-status**: Sent in response to a get-fuel-status request
    - `currentFuel`: Current fuel level
    - `maxFuel`: Maximum fuel capacity
    - `fuelPercentage`: Percentage of fuel remaining (0-100)
    - *Requires authentication*

12. **drilling-update**: Sent periodically with real-time drilling information
    - `currentCycleNumber`: The current cycle number
    - `onlineOperatorCount`: Number of online operators
    - `issuedHASH`: The total amount of HASH issued in the current cycle
    - `operatorEffData`: Data about operator efficiency and drilling difficulty
    - *Public access available*

13. **new-cycle**: Sent when a new drilling cycle is created
    - `_id`: The database ID of the drilling cycle
    - `cycleNumber`: The current cycle number
    - `startTime`: The start time of the drilling cycle
    - `endTime`: The end time of the drilling cycle
    - `extractorId`: The database ID of the drill that was selected as the extractor for this cycle
    - `activeOperators`: The number of active operators during this cycle
    - `difficulty`: An arbitrary difficulty value that determines how hard it is to extract $HASH during this cycle
    - `issuedHASH`: The total amount of $HASH that was issued during this cycle
    - `extractorOperatorId`: The database ID of the operator who owns the extractor drill
    - `extractorOperatorUsername`: The username of the operator who owns the extractor drill (if available)
    - `totalWeightedEff`: The total weighted efficiency from all operators in this cycle
    - *Public access available*

14. **cycle-reward**: Sent to operators who earned rewards in a specific cycle
    - `cycleNumber`: The cycle number for which the reward was earned
    - `operatorReward`: The amount of $HASH earned by the operator in this cycle
    - *Requires authentication*

15. **latest-cycle**: Sent in response to a get-latest-cycle request
    - Array of the latest 5 drilling cycles, each with the same structure as the new-cycle event
    - When requested by an authenticated operator, includes an additional `operatorReward` field with the operator's personal reward for each cycle
    - *Public access available* (personal rewards only included for authenticated users)

## Usage Example

```javascript
// Connect to the WebSocket server with authentication (for full access)
const socket = io('https://api.hashland.com', {
  auth: {
    token: jwtToken
  }
});

// OR connect without authentication (for public data only)
const publicSocket = io('https://api.hashland.com');

// Connection events
socket.on('connect', () => console.log('Connected to WebSocket server'));
socket.on('disconnect', () => console.log('Disconnected from WebSocket server'));

// Request current drilling status (authenticated only)
socket.emit('get-drilling-status');

// Request current fuel status (authenticated only)
socket.emit('get-fuel-status');

// Request recent cycle rewards (works for both authenticated and unauthenticated clients)
socket.emit('get-latest-cycle');
// OR for public data only
publicSocket.emit('get-latest-cycle');

// Listen for drilling status response (authenticated only)
socket.on('drilling-status', (data) => {
  console.log('Current drilling status:', data.status);
  if (data.status !== 'inactive') {
    console.log('Earned HASH:', data.earnedHASH);
    console.log('Current cycle:', data.currentCycleNumber);
  }
});

// Listen for fuel status response (authenticated only)
socket.on('fuel-status', (data) => {
  console.log('Current fuel:', data.currentFuel);
  console.log('Max fuel:', data.maxFuel);
  console.log('Fuel percentage:', data.fuelPercentage + '%');
});

// Start drilling (authenticated only)
socket.emit('start-drilling');

// Listen for drilling events (authenticated only)
socket.on('drilling-started', (data) => console.log('Drilling started:', data));
socket.on('drilling-activated', (data) => console.log('Drilling activated:', data));
socket.on('drilling-stopping', (data) => console.log('Drilling stopping:', data));
socket.on('drilling-completed', (data) => console.log('Drilling completed:', data));
socket.on('drilling-stopped', (data) => console.log('Drilling stopped:', data));
socket.on('drilling-error', (data) => console.error('Drilling error:', data.message));
socket.on('fuel-update', (data) => console.log('Fuel update:', data));

// Listen for public events (works for both authenticated and unauthenticated clients)
socket.on('drilling-update', (data) => console.log('Real-time update:', data));
publicSocket.on('drilling-update', (data) => console.log('Real-time update:', data));

// Listen for new cycle (works for both authenticated and unauthenticated clients)
socket.on('new-cycle', (data) => {
  console.log('New cycle created:', data.cycleNumber);
  console.log('Cycle start time:', new Date(data.startTime).toLocaleString());
  console.log('Extractor operator:', data.extractorOperatorUsername || 'No extractor');
  console.log('Total issued HASH:', data.issuedHASH);
  console.log('Total weighted efficiency:', data.totalWeightedEff);
});
// OR for public data only
publicSocket.on('new-cycle', (data) => {
  console.log('New cycle created:', data.cycleNumber);
  // Same data as above, available to unauthenticated clients
});

// Listen for personal cycle rewards (authenticated only)
socket.on('cycle-reward', (data) => {
  console.log(`You earned ${data.operatorReward} HASH in cycle #${data.cycleNumber}!`);
  // Update UI to show personal reward
  updateRewardDisplay(data.operatorReward);
});

// Listen for recent cycle history (works for both authenticated and unauthenticated clients)
socket.on('latest-cycle', (cycles) => {
  console.log('Recent cycle rewards:');
  cycles.forEach((cycle) => {
    console.log(`Cycle #${cycle.cycleNumber} (${new Date(cycle.startTime).toLocaleString()})`);
    console.log(`Extractor operator: ${cycle.extractorOperatorUsername || 'No extractor'}`);
    console.log(`Total issued HASH: ${cycle.issuedHASH}`);
    
    // If this is an authenticated request, operatorReward will be included
    if (cycle.operatorReward !== undefined) {
      console.log(`My reward: ${cycle.operatorReward} HASH`);
    }
    
    console.log('-------------------');
  });
});
// OR for public data only
publicSocket.on('latest-cycle', (cycles) => {
  // Will not include operatorReward field for unauthenticated clients
  console.log('Recent cycle data:', cycles);
});

// Stop drilling (authenticated only)
socket.emit('stop-drilling');
```

## Key Features
- JWT authentication for secure connections
- Public data access without authentication
- Automatic session termination on disconnection
- Fuel monitoring with automatic drilling stoppage
- Redis persistence for operator status and session data
- Real-time stats broadcasting
- Cycle-based session activation and completion

## Redis Storage
The gateway uses Redis to persist operator status and session data:
- `drilling:onlineOperators`: Stores the list of online operators
- `drilling:activeDrillingOperators`: Stores the mapping of actively drilling operators to their socket IDs
- `drilling:recent-cycle-rewards`: Stores the latest 5 drilling cycles
- `drilling-cycle:current`: Stores the current cycle number
- `drilling-cycle:{cycleNumber}:issuedHASH`: Stores the total HASH issued in a specific cycle
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
The system automatically stops drilling when an operator's fuel drops below the required threshold.

## Disconnection Handling
When an operator disconnects, the system:
1. Automatically ends any active drilling session
2. Updates Redis to reflect the operator's offline status
3. Broadcasts updated stats to all connected clients 