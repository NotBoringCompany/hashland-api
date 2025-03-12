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
   - `message`: Status message
   - `status`: Session status (COMPLETED)
   - `cycleNumber`: The cycle number when the session was completed
   - `earnedHASH`: The amount of HASH earned during the session

7. **drilling-stopped**: Sent when drilling stops immediately (e.g., due to fuel depletion)
   - `message`: Status message
   - `reason`: Reason for stopping (e.g., `fuel_depleted`)
   - `status`: Session status (COMPLETED)

8. **drilling-error**: Sent when an error occurs
   - `message`: Error details

9. **drilling-update**: Broadcasts real-time updates about the current drilling cycle
   - `currentCycleNumber`: The current cycle number
   - `onlineOperatorCount`: Number of online operators
   - `issuedHASH`: Amount of HASH issued in the current cycle
   - `operatorEffData`: Data about operator efficiency and drilling difficulty

### Client-to-Server Events
1. **start-drilling**: Start a drilling session
2. **stop-drilling**: Stop a drilling session

## Implementation in React

```jsx
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const useDrillingSocket = (token) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [drillingStatus, setDrillingStatus] = useState('inactive'); // inactive, waiting, active, stopping, completed
  const [stats, setStats] = useState({
    onlineOperators: 0,
    activeDrillingOperators: 0,
    currentCycle: 0,
    earnedHASH: 0
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;

    // Initialize socket with JWT auth
    const newSocket = io(process.env.REACT_APP_API_URL, {
      extraHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    // Connection events
    newSocket.on('connect', () => setConnected(true));
    newSocket.on('disconnect', () => {
      setConnected(false);
      setDrillingStatus('inactive');
    });

    // Drilling events
    newSocket.on('drilling-started', (data) => {
      setDrillingStatus('waiting');
      console.log('Drilling started in waiting status');
    });
    
    newSocket.on('drilling-activated', (data) => {
      setDrillingStatus('active');
      setStats(prev => ({
        ...prev,
        currentCycle: data.cycleNumber
      }));
      console.log(`Drilling activated in cycle #${data.cycleNumber}`);
    });
    
    newSocket.on('drilling-stopping', (data) => {
      setDrillingStatus('stopping');
      console.log('Drilling stopping initiated');
    });
    
    newSocket.on('drilling-completed', (data) => {
      setDrillingStatus('completed');
      setStats(prev => ({
        ...prev,
        earnedHASH: data.earnedHASH
      }));
      console.log(`Drilling completed with ${data.earnedHASH} HASH earned`);
      
      // Reset status after a delay
      setTimeout(() => setDrillingStatus('inactive'), 5000);
    });
    
    newSocket.on('drilling-stopped', (data) => {
      setDrillingStatus('inactive');
      console.log(`Drilling stopped: ${data.reason}`);
    });
    
    newSocket.on('drilling-error', (data) => setError(data.message));
    
    newSocket.on('drilling-info', (data) => {
      console.log(`Drilling info: ${data.message}`);
    });

    // Stats updates
    newSocket.on('online-operator-update', (data) => setStats(prev => ({
      ...prev,
      onlineOperators: data.onlineOperatorCount,
      activeDrillingOperators: data.activeDrillingOperatorCount
    })));
    
    newSocket.on('drilling-update', (data) => setStats(prev => ({
      ...prev,
      currentCycle: data.currentCycleNumber,
      issuedHASH: data.issuedHASH
    })));

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  // Control functions
  const startDrilling = () => {
    if (socket && connected && drillingStatus === 'inactive') {
      socket.emit('start-drilling');
    }
  };

  const stopDrilling = () => {
    if (socket && connected && (drillingStatus === 'waiting' || drillingStatus === 'active')) {
      socket.emit('stop-drilling');
    }
  };

  return {
    connected,
    drillingStatus,
    stats,
    error,
    startDrilling,
    stopDrilling
  };
};

// Usage example
const DrillingComponent = ({ token }) => {
  const { 
    connected, 
    drillingStatus, 
    stats, 
    error, 
    startDrilling, 
    stopDrilling 
  } = useDrillingSocket(token);

  return (
    <div>
      <div>Connection status: {connected ? 'Connected' : 'Disconnected'}</div>
      <div>Drilling status: {drillingStatus}</div>
      <div>Current cycle: {stats.currentCycle}</div>
      <div>Online operators: {stats.onlineOperators}</div>
      <div>Active drilling: {stats.activeDrillingOperators}</div>
      {drillingStatus === 'completed' && (
        <div className="success">Earned HASH: {stats.earnedHASH}</div>
      )}
      {error && <div className="error">Error: {error}</div>}
      
      <button 
        onClick={startDrilling} 
        disabled={!connected || drillingStatus !== 'inactive'}>
        Start Drilling
      </button>
      
      <button 
        onClick={stopDrilling} 
        disabled={!connected || (drillingStatus !== 'waiting' && drillingStatus !== 'active')}>
        Stop Drilling
      </button>
    </div>
  );
};
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