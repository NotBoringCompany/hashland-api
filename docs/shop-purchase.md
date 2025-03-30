# Shop Purchase Guide for Frontend

## Overview

The shop purchase flow allows operators to buy items from the HashLand shop using cryptocurrency. The system supports multiple blockchain transactions including TON and BERA chains. This guide explains how the shop purchase system works and how to implement it in your frontend application.

## Supported Items and Effects

The shop offers various items with different effects:

- **Drills**: Equipment that increases mining efficiency
- **Fuel Replenishment**: Items that replenish an operator's fuel
- **Max Fuel Increase**: Items that increase an operator's maximum fuel capacity

Each item has specific effects defined by the `ShopItemEffects` schema, which may include:
- `drillData`: Information about a drill (version, config, baseEff, maxLevel)
- `maxFuelIncrease`: Value to increase max fuel capacity
- `replenishFuelRatio`: Ratio of max fuel to replenish (0-1)

## Supported Payment Chains

The system currently supports the following payment chains:
- **TON** (The Open Network): For TON wallets
- **BERA**: For EVM-compatible wallets

## API Response Format

All HashLand API endpoints follow a consistent response format using our `ApiResponse` class:

```typescript
{
  status: number;    // HTTP status code (200, 400, 404, etc.)
  message: string;   // Message describing the result of the API call
  data: T | null;    // The actual response data (or null if no data)
}
```

Where `T` is the type of data returned by the specific endpoint. For Swagger documentation, we use `ApiResponse.withType(DataDto)` to ensure proper type information is included in the API docs.

## Purchase Flow

### 1. Check Prerequisites

Before attempting to purchase an item, you must first check if the operator meets all prerequisites for the purchase:

```typescript
// Example using fetch API
const checkPurchaseAllowed = async (
  operatorId: string,
  shopItemId: string,
  token: string
) => {
  const response = await fetch('https://api.hashland.app/shop-purchase/check-prerequisites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      operatorId,
      shopItemId,
      showShopItemEffects: true,
      showShopItemPrice: true
    }),
  });
  
  const result = await response.json();
  return result; // Standard API response format { status, message, data }
};
```

The response follows our standard API response format:

```typescript
{
  "status": 200,
  "message": "Purchase prerequisites check completed",
  "data": {
    "purchaseAllowed": true,
    "shopItemEffects": {
      "drillData": { /* drill data if applicable */ },
      "maxFuelIncrease": 50, // if applicable
      "replenishFuelRatio": 0.5 // if applicable
    },
    "shopItemPrice": {
      "ton": 0.95,
      "bera": 0.5
    }
  }
}
```

If purchase is not allowed, the `data` field will include the reason:

```typescript
{
  "status": 403,
  "message": "Purchase prerequisites check completed",
  "data": {
    "purchaseAllowed": false,
    "reason": "Requires at least 1 BASIC drills, but only 0 found."
  }
}
```

### 2. Initiate Blockchain Transaction

Once you've confirmed the purchase is allowed, you need to initiate the blockchain transaction using the appropriate wallet:

#### TON Wallet Transaction

```typescript
import { TonConnect } from '@tonconnect/sdk';
import TonWeb from 'tonweb';

const sendTonTransaction = async (
  receiverAddress: string,
  amount: number,
  message: string
) => {
  // Initialize TonConnect
  const tonConnect = new TonConnect({
    manifestUrl: 'https://your-app.com/tonconnect-manifest.json',
  });
  
  // Ensure wallet is connected
  if (!tonConnect.connected) {
    await tonConnect.connect();
  }
  
  // Create transfer parameters
  const transaction = {
    validUntil: Math.floor(Date.now() / 1000) + 360, // 5 minutes validity
    messages: [
      {
        address: receiverAddress,
        amount: TonWeb.utils.toNano(amount.toString()),
        payload: JSON.stringify({
          item: shopItemName,
          amt: 1,
          cost: amount,
          curr: 'TON'
        })
      }
    ]
  };
  
  // Send transaction
  const result = await tonConnect.sendTransaction(transaction);
  
  // Return the transaction BOC (Bag of Cells)
  return result.boc;
};
```

#### BERA Wallet Transaction (EVM)

```typescript
import { createWalletClient, custom, parseEther } from 'viem';
import { mainnet } from 'viem/chains';

const sendBeraTransaction = async (
  receiverAddress: string,
  amount: number
) => {
  // Initialize wallet client
  const walletClient = createWalletClient({
    chain: mainnet, // Replace with BERA chain config
    transport: custom(window.ethereum)
  });
  
  // Get address
  const [address] = await walletClient.getAddresses();
  
  // Send transaction
  const hash = await walletClient.sendTransaction({
    account: address,
    to: receiverAddress,
    value: parseEther(amount.toString())
  });
  
  return hash;
};
```

### 3. Complete the Purchase

After the transaction is completed, call the API to finalize the purchase:

```typescript
const completePurchase = async (
  operatorId: string,
  shopItemId: string,
  shopItemName: string,
  chain: 'TON' | 'BERA',
  address: string,
  txHash: string,
  token: string
) => {
  const response = await fetch('https://api.hashland.app/shop-purchase', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      operatorId,
      shopItemId,
      shopItemName,
      chain,
      address,
      txHash,
    }),
  });
  
  const result = await response.json();
  return result; // Standard API response format { status, message, data }
};
```

The response follows our standard API response format:

```typescript
{
  "status": 200,
  "message": "Item purchased successfully.",
  "data": {
    "shopPurchaseId": "507f1f77bcf86cd799439013",
    "operatorId": "507f1f77bcf86cd799439011",
    "itemPurchased": "REPLENISH_FUEL",
    "totalCost": 0.95,
    "currency": "TON",
    "createdAt": "2023-07-15T12:34:56.789Z"
  }
}
```

## Complete Purchase Flow Example

Here's a complete example showing how to implement the shop purchase flow in a React component:

```typescript
import React, { useState } from 'react';
import { TonConnect } from '@tonconnect/sdk';
import TonWeb from 'tonweb';
import { createWalletClient, custom, parseEther } from 'viem';
import { mainnet } from 'viem/chains';

const ShopPurchaseComponent = ({ operatorId, userToken }) => {
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedChain, setSelectedChain] = useState('TON');
  
  const handlePurchase = async () => {
    try {
      setLoading(true);
      
      // 1. Check if purchase is allowed
      const allowedResponse = await checkPurchaseAllowed(
        operatorId,
        selectedItem._id,
        userToken
      );
      
      if (!allowedResponse.data?.purchaseAllowed) {
        alert(`Purchase not allowed: ${allowedResponse.data?.reason}`);
        return;
      }
      
      // Get item price for the selected chain
      const price = allowedResponse.data.shopItemPrice[selectedChain.toLowerCase()];
      
      // 2. Initiate blockchain transaction
      let txHash;
      let walletAddress;
      
      if (selectedChain === 'TON') {
        // Initialize TonConnect
        const tonConnect = new TonConnect({
          manifestUrl: 'https://your-app.com/tonconnect-manifest.json',
        });
        
        // Ensure wallet is connected
        if (!tonConnect.connected) {
          await tonConnect.connect();
        }
        
        walletAddress = tonConnect.wallet.account.address;
        
        // Create transfer parameters
        const transaction = {
          validUntil: Math.floor(Date.now() / 1000) + 360, // 5 minutes validity
          messages: [
            {
              address: process.env.REACT_APP_TON_RECEIVER_ADDRESS,
              amount: TonWeb.utils.toNano(price.toString()),
              payload: JSON.stringify({
                item: selectedItem.item,
                amt: 1,
                cost: price,
                curr: 'TON'
              })
            }
          ]
        };
        
        // Send transaction
        const result = await tonConnect.sendTransaction(transaction);
        txHash = result.boc;
      } else if (selectedChain === 'BERA') {
        // Initialize wallet client
        const walletClient = createWalletClient({
          chain: mainnet, // Replace with BERA chain config
          transport: custom(window.ethereum)
        });
        
        // Get address
        const [address] = await walletClient.getAddresses();
        walletAddress = address;
        
        // Send transaction
        txHash = await walletClient.sendTransaction({
          account: address,
          to: process.env.REACT_APP_EVM_RECEIVER_ADDRESS,
          value: parseEther(price.toString())
        });
      }
      
      // 3. Complete the purchase
      const purchaseResponse = await completePurchase(
        operatorId,
        selectedItem._id,
        selectedItem.item,
        selectedChain,
        walletAddress,
        txHash,
        userToken
      );
      
      if (purchaseResponse.status === 200) {
        alert(`Purchase successful! Item ID: ${purchaseResponse.data.shopPurchaseId}`);
      } else {
        alert(`Purchase failed: ${purchaseResponse.message}`);
      }
    } catch (error) {
      console.error('Error during purchase:', error);
      alert(`Purchase error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <h2>Shop Purchase</h2>
      
      <div>
        <h3>Select Payment Method</h3>
        <select 
          value={selectedChain} 
          onChange={(e) => setSelectedChain(e.target.value)}
        >
          <option value="TON">TON</option>
          <option value="BERA">BERA</option>
        </select>
      </div>
      
      <button 
        onClick={handlePurchase} 
        disabled={loading || !selectedItem}
      >
        {loading ? 'Processing...' : 'Purchase Item'}
      </button>
    </div>
  );
};

export default ShopPurchaseComponent;
```

## Error Handling

When implementing the shop purchase flow, handle these common errors:

```typescript
try {
  // Purchase code here
} catch (error) {
  // Handle specific error cases
  if (error.message.includes('User rejected')) {
    // User rejected the transaction
    showNotification('Transaction was rejected by user');
  } else if (error.message.includes('Insufficient funds')) {
    // User doesn't have enough funds
    showNotification('Insufficient funds for this purchase');
  } else if (error.message.includes('Invalid transaction')) {
    // Transaction verification failed
    showNotification('Transaction verification failed');
  } else if (error.message.includes('purchase prerequisites')) {
    // User doesn't meet prerequisites
    showNotification('You don\'t meet the requirements for this item');
  } else {
    // Generic error
    showNotification('Failed to complete purchase: ' + error.message);
  }
}
```

## Prerequisites for Advanced Items

Some shop items, particularly advanced drills, have specific prerequisites:

- **Bulwark Drill**: Requires a minimum number of Ironbore drills and minimum max fuel
- **Titan Drill**: Requires a minimum number of Bulwark drills and minimum max fuel
- **Dreadnought Drill**: Requires a minimum number of Titan drills and minimum max fuel

Always check prerequisites before allowing a purchase to prevent wasted transactions.

## Transaction Verification

The backend verifies transactions through:

- **TON transactions**: Using the TonService to verify BOC (Bag of Cells) and transaction details
- **BERA transactions**: Using the AlchemyService to verify transaction hash, sender, receiver, and value

The verification process ensures:
1. The transaction is valid and has been confirmed on the blockchain
2. The transaction was sent to the correct receiver address
3. The transaction amount matches the item price
4. The transaction includes the correct metadata

## Implementation Tips

1. Always check prerequisites before initiating transactions to avoid users paying for items they can't receive
2. Implement proper error handling to provide clear feedback to users
3. Include loading states during blockchain operations
4. Consider adding transaction confirmation steps before sending 
5. Include retry mechanisms for failed API calls
6. Keep the UI simple and provide clear instructions to users

## Related Resources

- [Wallet Connection Guide](/docs/wallet-connection.md) - Instructions for connecting wallets
- [TON Documentation](https://docs.ton.org/) - Official TON blockchain documentation
- [Viem Documentation](https://viem.sh/) - Library for interacting with EVM-compatible chains 