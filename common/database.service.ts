import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

/**
 * DatabaseService is responsible for handling MongoDB connection events
 * and ensuring the database connection lifecycle is properly managed.
 *
 * It listens to events like `connected`, `error`, and `disconnected` and
 * gracefully closes the connection when the application shuts down.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  /**
   * Injects the MongoDB connection instance provided by `@nestjs/mongoose`.
   * This allows us to interact with the database connection directly.
   */
  constructor(@InjectConnection() private readonly connection: Connection) {}

  /**
   * Called when the module is initialized.
   * This is where we set up event listeners for MongoDB connection events.
   */
  async onModuleInit() {
    console.log('📦 DatabaseModule Initialized');

    /**
     * Listens for a successful connection to MongoDB.
     * If the database connects successfully, it logs the MongoDB URI.
     */
    this.connection.on('connected', () => {
      console.log(`✅ MongoDB Connected: ${process.env.MONGO_URI}`);
    });

    /**
     * Listens for MongoDB connection errors.
     * If an error occurs, it logs the error details.
     */
    this.connection.on('error', (err: any) => {
      console.error('❌ MongoDB Connection Error:', err);
    });

    /**
     * Listens for disconnection events.
     * If MongoDB gets disconnected, a warning is logged.
     */
    this.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB Disconnected. Reconnecting...');
    });
  }

  /**
   * Called when the module is destroyed (i.e., when the app shuts down).
   * This ensures that the MongoDB connection is gracefully closed.
   */
  async onModuleDestroy() {
    console.log('🔌 Closing MongoDB Connection...');
    await this.connection.close();
  }
}
