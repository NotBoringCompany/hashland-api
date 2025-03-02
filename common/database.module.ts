import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';

console.log(`Checking for MongoDB URI: ${process.env.MONGO_URI}`);

/**
 * DatabaseModule initializes MongoDB connection
 * and applies connection pooling for scalability.
 */
@Module({
  imports: [
    ConfigModule, // ✅ Import ConfigModule to access .env values
    MongooseModule.forRootAsync({
      imports: [ConfigModule], // ✅ Ensure ConfigModule is available
      inject: [ConfigService], // ✅ Inject ConfigService to access .env values
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
        dbName: configService.get<string>('DATABASE_NAME', 'test'),
        connectionFactory: (connection) => {
          console.log(
            `✅ MongoDB Connected: ${configService.get<string>('MONGO_URI')}`,
          );
          return connection;
        },
        // ✅ Connection Pooling Settings
        maxPoolSize: configService.get<number>('MONGO_MAX_POOL_SIZE', 50),
        minPoolSize: configService.get<number>('MONGO_MIN_POOL_SIZE', 5),
        serverSelectionTimeoutMS: configService.get<number>(
          'MONGO_SERVER_SELECTION_TIMEOUT',
          30000,
        ),
        socketTimeoutMS: configService.get<number>(
          'MONGO_SOCKET_TIMEOUT',
          45000,
        ),
        waitQueueTimeoutMS: configService.get<number>(
          'MONGO_WAIT_QUEUE_TIMEOUT',
          5000,
        ),
        heartbeatFrequencyMS: configService.get<number>(
          'MONGO_HEARTBEAT_FREQUENCY',
          10000,
        ),
      }),
    }),
  ],
  providers: [DatabaseService], // ✅ Provides DatabaseService for event handling
  exports: [MongooseModule, DatabaseService], // ✅ Exports Mongoose for use in other modules
})
export class DatabaseModule {}
