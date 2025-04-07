# Wallet Connection Guide for Frontend

This guide explains how to integrate with the HashLand API wallet connection endpoints from your frontend application.

## Overview

The wallet connection flow allows operators (users) to connect their cryptocurrency wallets to their HashLand account. HashLand supports multiple chains including TON and BERA. These wallet connections are used for authentication, asset equity calculation, and other wallet-related operations.

## Supported Chains

The system currently supports the following chains:
- TON (The Open Network) - Compatible with TON wallets and Telegram Wallet
- BERA - Compatible with EVM-based wallets

## Connection Flow

### 1. Generate a Proof Challenge (TON wallets)

For TON wallets, request a proof challenge from the server. This challenge will be signed by the user's wallet to prove ownership.

```typescript
// Example using fetch API
const generateProofChallenge = async (address: string, chain: string = 'TON') => {
  const response = await fetch('https://api.hashland.app/operators/wallets/generate-proof', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      address,
      chain,
    }),
  });
  
  const data = await response.json();
  return data.data; // { message: string, nonce: string }
};
```

### 1.1 Request an EVM Signature Message (EVM-based chains like BERA)

For EVM wallets (e.g., BERA), request a signature message:

```typescript
// Example using fetch API
const requestEVMSignatureMessage = async (address: string) => {
  const response = await fetch(`https://api.hashland.app/operators/wallets/request-evm-signature-message?address=${address}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  const message = await response.text();
  return message;
};
```

### 2. Sign the Challenge Message

Have the user sign the challenge message using their wallet. The implementation depends on the wallet provider:

#### TON Connect (Tonkeeper, etc.)

```typescript
import { TonConnect } from '@tonconnect/sdk';

// Initialize TonConnect
const tonConnect = new TonConnect({
  manifestUrl: 'https://your-app.com/tonconnect-manifest.json',
});

// Connect to wallet
await tonConnect.connect();

// Sign the message
const signatureResponse = await tonConnect.signMessage({
  text: challengeMessage,
});

// Extract signature
const signature = signatureResponse.signature;
```

#### Telegram Wallet

For Telegram Wallet, you'll receive a TON proof object when the user connects:

```typescript
// Using Telegram Wallet API
const telegramProof = await window.Telegram.WebApp.connectWallet();

// The proof object will look like:
const tonProof = {
  proof: {
    timestamp: 1646146412,
    domain: {
      lengthBytes: 17,
      value: 'hashland.ton.app',
    },
    signature: '0x123abc...',
    payload: '0x456def...',
  },
  tonAddress: 'EQAbc123...',
};
```

#### EVM Wallets (BERA chain)

For EVM-compatible wallets, use the standard signing method with viem:

```typescript
// Using viem
import { createWalletClient, custom, signMessage } from 'viem';
import { mainnet } from 'viem/chains';

// Connect to wallet
const walletClient = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum)
});

// Get the address
const [address] = await walletClient.getAddresses();

// Get the message to sign
const message = await requestEVMSignatureMessage(address);

// Sign the message
const signature = await walletClient.signMessage({
  account: address,
  message
});
```

### 3. Connect the Wallet

Send the signed message or TON proof to the server to connect the wallet to the operator's account:

#### Using a Signature (TON or BERA)

```typescript
const connectWallet = async (
  address: string,
  chain: string, // 'TON' or 'BERA'
  signature: string,
  signatureMessage: string,
  token: string
) => {
  const response = await fetch('https://api.hashland.app/operators/wallets/connect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      address,
      chain,
      signature,
      signatureMessage,
    }),
  });
  
  return response.json();
};
```

#### Using TON Proof from Telegram

```typescript
const connectWalletWithTonProof = async (
  address: string,
  chain: string, // Must be 'TON'
  tonProof: any,
  token: string
) => {
  const response = await fetch('https://api.hashland.app/operators/wallets/connect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      address,
      chain,
      signature: '', // Can be empty when using tonProof
      signatureMessage: '', // Can be empty when using tonProof
      tonProof,
    }),
  });
  
  return response.json();
};
```

## Managing Connected Wallets

### Get All Connected Wallets

Retrieve all wallets connected to the operator's account:

```typescript
const getConnectedWallets = async (token: string) => {
  const response = await fetch('https://api.hashland.app/operators/wallets', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  const data = await response.json();
  return data.data; // Array of connected wallets with chain information
};
```

### Disconnect a Wallet

Remove a wallet from the operator's account:

```typescript
const disconnectWallet = async (walletId: string, token: string) => {
  const response = await fetch(`https://api.hashland.app/operators/wallets/${walletId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  return response.json();
};
```

## Asset Equity Calculation

When a wallet is connected, the system automatically calculates the operator's asset equity based on the balances of their connected wallets across all supported chains. The system checks for:

- On TON chain: Native TON tokens, USDT and USDC jettons
- On BERA chain: Native BERA tokens, USDT and USDC tokens

This equity value is used to determine the operator's efficiency multiplier and affects their overall mining capabilities.

## Complete Connection Flow Examples

### TON Wallet Connection Example

```typescript
// React component example
import React, { useState } from 'react';
import { TonConnect } from '@tonconnect/sdk';

const TonWalletConnector = ({ userToken }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [wallets, setWallets] = useState([]);
  const tonConnect = new TonConnect({
    manifestUrl: 'https://your-app.com/tonconnect-manifest.json',
  });

  const connectWallet = async () => {
    try {
      setIsConnecting(true);
      
      // 1. Connect to wallet and get address
      await tonConnect.connect();
      const walletInfo = tonConnect.wallet;
      const address = walletInfo.account.address;
      
      // 2. Generate proof challenge
      const challenge = await generateProofChallenge(address, 'TON');
      
      // 3. Sign the challenge
      const signatureResponse = await tonConnect.signMessage({
        text: challenge.message,
      });
      
      // 4. Connect wallet to operator account
      await connectWallet(
        address,
        'TON',
        signatureResponse.signature,
        challenge.message,
        userToken
      );
      
      // 5. Refresh wallet list
      const walletList = await getConnectedWallets(userToken);
      setWallets(walletList);
      
    } catch (error) {
      console.error('Error connecting wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (walletId) => {
    try {
      await disconnectWallet(walletId, userToken);
      // Refresh wallet list
      const walletList = await getConnectedWallets(userToken);
      setWallets(walletList);
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  return (
    <div>
      <h2>Your Connected Wallets</h2>
      
      <button 
        onClick={connectWallet} 
        disabled={isConnecting}
      >
        {isConnecting ? 'Connecting...' : 'Connect TON Wallet'}
      </button>
      
      <div>
        {wallets.map(wallet => (
          <div key={wallet._id}>
            <p>Address: {wallet.address}</p>
            <p>Chain: {wallet.chain}</p>
            <button onClick={() => handleDisconnect(wallet._id)}>
              Disconnect
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TonWalletConnector;
```

### BERA Wallet Connection Example

```typescript
// React component example for BERA wallet connection
import React, { useState } from 'react';
import { createWalletClient, custom, signMessage } from 'viem';
import { mainnet } from 'viem/chains';

const BeraWalletConnector = ({ userToken }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [wallets, setWallets] = useState([]);

  const connectWallet = async () => {
    try {
      setIsConnecting(true);
      
      // 1. Connect to wallet and get address
      const walletClient = createWalletClient({
        chain: mainnet, // Replace with BERA chain config if available
        transport: custom(window.ethereum)
      });
      
      const [address] = await walletClient.getAddresses();
      
      // 2. Get signature message
      const message = await requestEVMSignatureMessage(address);
      
      // 3. Sign the message
      const signature = await walletClient.signMessage({
        account: address,
        message
      });
      
      // 4. Connect wallet to operator account
      await connectWallet(
        address,
        'BERA',
        signature,
        message,
        userToken
      );
      
      // 5. Refresh wallet list
      const walletList = await getConnectedWallets(userToken);
      setWallets(walletList);
      
    } catch (error) {
      console.error('Error connecting wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (walletId) => {
    try {
      await disconnectWallet(walletId, userToken);
      // Refresh wallet list
      const walletList = await getConnectedWallets(userToken);
      setWallets(walletList);
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  return (
    <div>
      <h2>Your Connected BERA Wallets</h2>
      
      <button 
        onClick={connectWallet} 
        disabled={isConnecting}
      >
        {isConnecting ? 'Connecting...' : 'Connect BERA Wallet'}
      </button>
      
      <div>
        {wallets
          .filter(wallet => wallet.chain === 'BERA')
          .map(wallet => (
            <div key={wallet._id}>
              <p>Address: {wallet.address}</p>
              <p>Chain: {wallet.chain}</p>
              <button onClick={() => handleDisconnect(wallet._id)}>
                Disconnect
              </button>
            </div>
          ))
        }
      </div>
    </div>
  );
};

export default BeraWalletConnector;
```

## Telegram Wallet Integration

For Telegram Wallet integration, you'll need to use the Telegram WebApp API:

```typescript
// Initialize Telegram WebApp
const initTelegramWallet = () => {
  if (!window.Telegram || !window.Telegram.WebApp) {
    console.error('Telegram WebApp is not available');
    return false;
  }
  
  return true;
};

// Connect Telegram Wallet
const connectTelegramWallet = async (userToken) => {
  if (!initTelegramWallet()) return;
  
  try {
    // Request wallet connection
    const result = await window.Telegram.WebApp.connectWallet();
    
    if (result && result.tonProof) {
      // Connect wallet using TON proof
      await connectWalletWithTonProof(
        result.tonProof.tonAddress,
        'TON',
        result.tonProof,
        userToken
      );
      
      return true;
    }
  } catch (error) {
    console.error('Error connecting Telegram wallet:', error);
    return false;
  }
};
```

## Chain Limitations

- **One Wallet Per Chain**: Each operator can connect only one wallet per blockchain. Attempting to connect a second wallet on the same chain will result in an error.

## Error Handling

Always implement proper error handling for wallet connections:

```typescript
try {
  // Wallet connection code
} catch (error) {
  // Check for specific error types
  if (error.message.includes('User rejected')) {
    // User rejected the connection
    showNotification('Connection was rejected by user');
  } else if (error.message.includes('timeout')) {
    // Connection timed out
    showNotification('Connection timed out, please try again');
  } else if (error.message.includes('already has a connected wallet in this chain')) {
    // Already has a wallet in this chain
    showNotification('You already have a wallet connected on this chain');
  } else {
    // Generic error
    showNotification('Failed to connect wallet: ' + error.message);
  }
}
```

## Security Considerations

1. **Always verify signatures on the server**: Never trust client-side validation alone.
2. **Use HTTPS**: All API requests should be made over HTTPS.
3. **Implement rate limiting**: Protect against brute force attacks.
4. **Validate all inputs**: Both on the client and server side.
5. **Use short-lived challenges**: The server should reject old challenge messages.
6. **Regularly check wallet balances**: The system automatically updates asset equity when wallets are connected.

## Troubleshooting

Common issues and solutions:

1. **"Invalid signature" error**: Ensure the message being signed is exactly the same as the challenge message from the server.
2. **Connection timeout**: Check network connectivity and wallet provider status.
3. **Wallet not supported**: Ensure you're using a compatible wallet provider.
4. **Authorization errors**: Verify the JWT token is valid and not expired.
5. **Chain already connected**: Each operator can have only one wallet per chain. Disconnect the existing wallet first.
