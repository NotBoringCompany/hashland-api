import { StateInit } from '@ton/core';
import { Buffer } from 'buffer';

/**
 * Try to parse public key from wallet state init
 * This function tries to extract the public key from various wallet versions
 */
export function tryParsePublicKey(stateInit: StateInit): Buffer | null {
  // No data cell, can't extract public key
  if (!stateInit.data) {
    return null;
  }

  const dataCell = stateInit.data;

  try {
    // Try to parse as various wallet versions
    const slice = dataCell.beginParse();

    // Try as v3R1/v3R2 wallet
    try {
      // Skip the 32-bit subwallet_id
      slice.skip(32);

      // Read the 256-bit public key as a buffer
      const publicKeyBuffer = slice.loadBuffer(32); // 256 bits = 32 bytes
      return publicKeyBuffer;
    } catch {
      // Not a v3 wallet format
    }

    // Try as v4R2 wallet
    try {
      // Reset slice
      const sliceV4 = dataCell.beginParse();

      // Skip the 32-bit subwallet_id and 8-bit flags
      sliceV4.skip(32 + 8);

      // Read the 256-bit public key as a buffer
      const publicKeyBuffer = sliceV4.loadBuffer(32); // 256 bits = 32 bytes
      return publicKeyBuffer;
    } catch {
      // Not a v4R2 wallet format
    }

    // Add additional wallet format parsers as needed

    return null;
  } catch (error) {
    console.error('Error parsing wallet state init:', error);
    return null;
  }
}
