import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseService } from './database.service';
import { ConfigModule } from '@nestjs/config';

/**
 * DatabaseModule initializes MongoDB connection
 * and applies connection pooling.
 */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => {
        console.log(`Mongo URI: ${process.env.MONGO_URI}`);

        if (!process.env.MONGO_URI) {
          throw new Error('❌ MONGO_URI is missing. Check your .env file.');
        }

        return {
          uri: process.env.MONGO_URI,
          dbName: process.env.DATABASE_NAME || 'test',
          connectionFactory: (connection) => {
            console.log(
              `✅ MongoDB Connected: ${process.env.MONGO_URI}/${process.env.DATABASE_NAME}`,
            );
            return connection;
          },
          // ✅ Connection Pooling Settings (optimized for high concurrency)
          maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE) || 50, // Default: 50 connections
          minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE) || 5, // Keep at least 5 connections active
          serverSelectionTimeoutMS:
            parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT) || 30000,
          socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT) || 45000,
          waitQueueTimeoutMS:
            parseInt(process.env.MONGO_WAIT_QUEUE_TIMEOUT) || 5000,
          heartbeatFrequencyMS:
            parseInt(process.env.MONGO_HEARTBEAT_FREQUENCY) || 10000,
        };
      },
    }),
  ],
  providers: [DatabaseService], // Registers DatabaseService for event handling
  exports: [MongooseModule], // Exports MongooseModule
})
export class DatabaseModule {}
