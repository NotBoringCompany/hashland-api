// import { Injectable } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import * as crypto from 'crypto';

// @Injectable()
// export class WalletEncryptionUtil {
//   private readonly encryptionKey: Buffer;
//   private readonly algorithm = 'aes-256-gcm';

//   constructor(private configService: ConfigService) {
//     // Get encryption key from environment or generate one
//     const key = this.configService.get<string>('WALLET_ENCRYPTION_KEY');
//     if (!key) {
//       throw new Error(
//         'WALLET_ENCRYPTION_KEY is not defined in environment variables',
//       );
//     }

//     // Create a buffer from the hex string key
//     this.encryptionKey = Buffer.from(key, 'hex');
//   }

//   /**
//    * Encrypt sensitive wallet data
//    */
//   encrypt(data: string): {
//     encryptedData: string;
//     iv: string;
//     authTag: string;
//   } {
//     // Generate a random initialization vector
//     const iv = crypto.randomBytes(16);

//     // Create cipher
//     const cipher = crypto.createCipheriv(
//       this.algorithm,
//       this.encryptionKey,
//       iv,
//     );

//     // Encrypt the data
//     let encrypted = cipher.update(data, 'utf8', 'hex');
//     encrypted += cipher.final('hex');

//     // Get the authentication tag
//     const authTag = cipher.getAuthTag().toString('hex');

//     return {
//       encryptedData: encrypted,
//       iv: iv.toString('hex'),
//       authTag,
//     };
//   }

//   /**
//    * Decrypt sensitive wallet data
//    */
//   decrypt(encryptedData: string, iv: string, authTag: string): string {
//     try {
//       // Create decipher
//       const decipher = crypto.createDecipheriv(
//         this.algorithm,
//         this.encryptionKey,
//         Buffer.from(iv, 'hex'),
//       );

//       // Set auth tag
//       decipher.setAuthTag(Buffer.from(authTag, 'hex'));

//       // Decrypt the data
//       let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
//       decrypted += decipher.final('utf8');

//       return decrypted;
//     } catch (error) {
//       throw new Error(`Decryption failed: ${error.message}`);
//     }
//   }

//   /**
//    * Encrypt an object
//    */
//   encryptObject(obj: Record<string, any>): string {
//     const jsonString = JSON.stringify(obj);
//     const { encryptedData, iv, authTag } = this.encrypt(jsonString);

//     // Return a combined string with all parts needed for decryption
//     return `${encryptedData}:${iv}:${authTag}`;
//   }

//   /**
//    * Decrypt an object
//    */
//   decryptObject<T>(encryptedString: string): T {
//     const [encryptedData, iv, authTag] = encryptedString.split(':');
//     const jsonString = this.decrypt(encryptedData, iv, authTag);
//     return JSON.parse(jsonString) as T;
//   }
// }
