# Drilling Gateway Documentation

## Overview
The Drilling Gateway provides real-time WebSocket communication for the drilling functionality in the Hashland API. It handles operator connections, drilling sessions, and broadcasts real-time updates to connected clients.

## Authentication
The gateway uses JWT authentication. Clients must include a valid JWT token in the authorization header when connecting.

## Available Events

### Server-to-Client Events
1. **online-operator-update**: Broadcasts when operators connect/disconnect
   - `onlineOperatorCount`: Number of online operators
   - `activeDrillingOperatorCount`: Number of actively drilling operators

2. **drilling-started**: Sent when drilling starts successfully
   - `message`: Success message

3. **drilling-stopped**: Sent when drilling stops
   - `message`: Status message
   - `reason`: Optional reason (e.g., `fuel_depleted`)

4. **drilling-error**: Sent when an error occurs
   - `message`: Error details

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
  const [isDrilling, setIsDrilling] = useState(false);
  const [stats, setStats] = useState({
    onlineOperators: 0,
    activeDrillingOperators: 0
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
      setIsDrilling(false);
    });

    // Drilling events
    newSocket.on('drilling-started', () => setIsDrilling(true));
    newSocket.on('drilling-stopped', () => setIsDrilling(false));
    newSocket.on('drilling-error', (data) => setError(data.message));

    // Stats updates
    newSocket.on('online-operator-update', (data) => setStats({
      onlineOperators: data.onlineOperatorCount,
      activeDrillingOperators: data.activeDrillingOperatorCount
    }));

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  // Control functions
  const startDrilling = () => {
    if (socket && connected) {
      socket.emit('start-drilling');
    }
  };

  const stopDrilling = () => {
    if (socket && connected) {
      socket.emit('stop-drilling');
    }
  };

  return {
    connected,
    isDrilling,
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
    isDrilling, 
    stats, 
    error, 
    startDrilling, 
    stopDrilling 
  } = useDrillingSocket(token);

  return (
    <div>
      <div>Connection status: {connected ? 'Connected' : 'Disconnected'}</div>
      <div>Drilling status: {isDrilling ? 'Drilling' : 'Not drilling'}</div>
      <div>Online operators: {stats.onlineOperators}</div>
      <div>Active drilling: {stats.activeDrillingOperators}</div>
      {error && <div className="error">Error: {error}</div>}
      
      <button 
        onClick={startDrilling} 
        disabled={!connected || isDrilling}>
        Start Drilling
      </button>
      
      <button 
        onClick={stopDrilling} 
        disabled={!connected || !isDrilling}>
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
- Redis persistence for operator status across server restarts
- Real-time stats broadcasting

## Error Handling
The gateway handles various error scenarios including:
- Authentication failures
- Insufficient fuel
- Connection issues
- Session management errors

All errors are logged server-side and relevant errors are sent to clients via the `drilling-error` event.

## Technical Implementation Details

### Redis Storage
The gateway uses Redis to persist operator status:
- `drilling:onlineOperators`: Stores the list of online operators
- `drilling:activeDrillingOperators`: Stores the mapping of actively drilling operators to their socket IDs

### Automatic Fuel Monitoring
The system automatically stops drilling when an operator's fuel drops below the threshold defined in `GAME_CONSTANTS.FUEL.BASE_FUEL_DEPLETION_RATE.maxUnits`.

### Disconnection Handling
When an operator disconnects, the system:
1. Automatically ends any active drilling session
2. Updates Redis to reflect the operator's offline status
3. Broadcasts updated stats to all connected clients 