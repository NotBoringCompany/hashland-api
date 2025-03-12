# Drilling Cycle System

## Overview
The drilling cycle system manages the time-based cycles for the Hashland drilling mechanism. Each cycle represents a fixed time period during which operators can drill for $HASH tokens. The system handles cycle creation, extractor selection, reward distribution, and fuel management.

## Cycle Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Cycle      │────▶│  Activate   │────▶│  Distribute │────▶│  End Cycle  │
│  Created    │     │  Sessions   │     │  Rewards    │     │  & Process  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

1. **Cycle Creation**: A new cycle is created every `CYCLE_DURATION` seconds
2. **Session Activation**: All waiting drilling sessions are activated
3. **Reward Distribution**: At the end of the cycle, rewards are distributed
4. **Cycle End Processing**: Fuel is processed and stopping sessions are completed

## Key Components

### DrillingCycleService
The core service that manages cycle creation, reward distribution, and fuel processing.

### DrillingCycleQueue
A Bull queue implementation that schedules cycle creation and processing.

## Cycle Data Structure

Each drilling cycle is stored in MongoDB with the following schema:
- `cycleNumber`: The unique identifier for the cycle
- `startTime`: When the cycle started
- `endTime`: When the cycle is scheduled to end
- `activeOperators`: Number of active operators during the cycle
- `extractorId`: ID of the selected extractor drill
- `difficulty`: The mining difficulty for the cycle
- `issuedHASH`: Amount of HASH issued in the cycle

## Redis Storage
For performance reasons, some cycle data is also stored in Redis:
- `drilling-cycle:current`: The current cycle number
- `drilling-cycle:{cycleNumber}:issuedHASH`: The amount of HASH issued in a specific cycle

## Cycle Creation Process

1. Increment the cycle number in Redis
2. Store the HASH issuance amount in Redis
3. Activate all waiting drilling sessions
4. Create a new cycle document in MongoDB
5. Send real-time updates via WebSocket

## Cycle End Process

1. Select an extractor drill for the cycle
2. Distribute rewards to operators
3. Process fuel for all operators
4. Update the cycle with the selected extractor
5. Complete any stopping sessions

## Reward Distribution

### Solo Operator Rewards
When the extractor is a solo operator:
- Extractor receives `SOLO_OPERATOR_REWARD_SYSTEM.extractorOperator` percentage of issued HASH
- All active operators share `SOLO_OPERATOR_REWARD_SYSTEM.allActiveOperators` percentage based on their weighted efficiency

### Pool Operator Rewards
When the extractor is part of a pool:
- Extractor receives `rewardSystem.extractorOperator` percentage of issued HASH
- Pool leader receives `rewardSystem.leader` percentage of issued HASH
- Active pool operators share `rewardSystem.activePoolOperators` percentage based on their weighted efficiency

## Fuel Processing

At the end of each cycle:
1. Active operators have fuel depleted by a random amount
2. Inactive operators have fuel replenished by a random amount
3. Operators who drop below the fuel threshold have their drilling sessions stopped

## WebSocket Integration

The system sends real-time updates via WebSocket:
- When a new cycle starts
- When sessions are activated
- When rewards are distributed
- When sessions are completed

## Performance Considerations

### Batch Operations
The system uses batch operations for:
- Activating multiple sessions at once
- Distributing rewards to multiple operators
- Processing fuel for multiple operators

### Redis for Fast Access
Redis is used for data that needs to be accessed frequently:
- Current cycle number
- HASH issuance amounts
- Active session counts

### Performance Monitoring
The system includes performance monitoring:
- Execution time logging for critical operations
- Detailed logs for cycle creation and processing

## API

### DrillingCycleService Methods

#### `createDrillingCycle(): Promise<number>`
Creates a new drilling cycle and returns the cycle number.

#### `endCurrentCycle(cycleNumber: number): Promise<void>`
Ends the current drilling cycle and processes rewards and fuel.

#### `distributeCycleRewards(extractorId: Types.ObjectId, issuedHash: number): Promise<void>`
Distributes rewards to operators based on the selected extractor.

#### `batchIssueHashRewards(rewardData: { operatorId: Types.ObjectId; amount: number }[]): Promise<void>`
Issues HASH rewards to multiple operators in a batch operation.

#### `processFuelForAllOperators(currentCycleNumber: number): Promise<void>`
Processes fuel for all operators at the end of a cycle.

#### `getCurrentCycleNumber(): Promise<ApiResponse<{ cycleNumber: number }>>`
Gets the current cycle number from Redis.

### DrillingCycleQueue Methods

#### `handleNewDrillingCycle(): Promise<void>`
Handles the creation of a new drilling cycle and the processing of the previous cycle. 