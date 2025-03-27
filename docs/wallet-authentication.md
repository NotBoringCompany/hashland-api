# Wallet Authentication

This document describes how to implement wallet-based authentication in Hashland, which allows operators to log in using their connected wallets.

## Overview

Hashland supports authentication using various wallet types:
- EVM-compatible wallets (Ethereum, Optimism, Arbitrum, Base, Polygon, BERA)
- TON wallets

An operator can have multiple wallets connected to their account and can use any of them to authenticate. If a wallet is not yet linked to any operator, a new operator account will be automatically created during the authentication process.

## API Endpoints

### Get EVM Signature Message
```http
GET /auth/wallet/message?address={wallet_address}
```

Returns a message that needs to be signed by the wallet to authenticate.

**Parameters:**
- `address` (query): The wallet address requesting authentication

**Response:**
```json
{
    "message": "Please sign the following message to link your wallet.\nWallet address: 0x1234...\nTimestamp: 1234567890\nHash salt: 0xabcd..."
}
```

### Authenticate with Wallet
```http
POST /auth/wallet/login
```

Authenticates an operator using their wallet signature.

**Request Body:**
```json
{
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "signature": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b",
    "message": "Please sign the following message...",
    "chain": "ETH"
}
```

**Response:**
```json
{
    "status": 200,
    "message": "Authenticated",
    "data": {
        "operator": {
            "_id": "507f1f77bcf86cd799439011",
            "username": "operator1",
            // ... other operator fields
        },
        "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
}
```

## Frontend Implementation

Here's how to implement wallet authentication in your frontend application:

### 1. EVM Wallet Authentication (e.g., MetaMask)

```typescript
import { ethers } from 'ethers';

const authenticateWithEVMWallet = async () => {
  try {
    // 1. Check if wallet is available
    if (!window.ethereum) {
      throw new Error('No EVM wallet found');
    }

    // 2. Request account access
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    const address = accounts[0];

    // 3. Get the message to sign
    const response = await fetch(
      `${API_URL}/auth/wallet/message?address=${address}`
    );
    const { message } = await response.json();

    // 4. Sign the message
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const signature = await signer.signMessage(message);

    // 5. Authenticate with the backend
    const authResponse = await fetch(`${API_URL}/auth/wallet/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address,
        signature,
        message,
        chain: 'ETH', // or other EVM chain
      }),
    });

    const { data } = await authResponse.json();
    
    // 6. Store the JWT token
    localStorage.setItem('token', data.accessToken);
    
    return data;
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
};
```

### 2. TON Wallet Authentication (e.g., TonKeeper)

```typescript
import { TonConnect } from '@tonconnect/sdk';

const authenticateWithTONWallet = async () => {
  try {
    // 1. Initialize TON Connect
    const connector = new TonConnect();
    
    // 2. Connect to wallet
    await connector.connect();
    const walletInfo = await connector.account;
    
    if (!walletInfo) {
      throw new Error('No TON wallet connected');
    }

    // 3. Get the message to sign
    const response = await fetch(
      `${API_URL}/auth/wallet/message?address=${walletInfo.address}`
    );
    const { message } = await response.json();

    // 4. Sign the message
    const { signature } = await connector.signMessage(message);

    // 5. Authenticate with the backend
    const authResponse = await fetch(`${API_URL}/auth/wallet/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: walletInfo.address,
        signature,
        message,
        chain: 'TON',
      }),
    });

    const { data } = await authResponse.json();
    
    // 6. Store the JWT token
    localStorage.setItem('token', data.accessToken);
    
    return data;
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
};
```

## Error Handling

The authentication endpoints may return the following errors:

- `401 Unauthorized`:
  - Invalid wallet signature
  - Operator not found

- `400 Bad Request`:
  - Missing required fields
  - Invalid chain specified
  - Invalid message format

- `500 Internal Server Error`:
  - Server-side errors during authentication

## Security Considerations
