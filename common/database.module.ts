import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatabaseService } from './database.service';

/**
 * The DatabaseModule is responsible for establishing a MongoDB connection
 * and managing database-related services.
 *
 * It uses `MongooseModule.forRootAsync()` to dynamically load MongoDB connection settings
 * from environment variables, ensuring flexibility and best practices.
 */
@Module({
  imports: [
    /**
     * Configures MongoDB connection using `MongooseModule.forRootAsync()`.
     * This allows dynamic configuration, making it more flexible for different environments.
     */
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGO_URI,
        dbName: process.env.DATABASE_NAME ?? 'test',
      }),
    }),
  ],
  providers: [DatabaseService], // Registers the DatabaseService for managing connection events
  exports: [MongooseModule, DatabaseService], // Exports Mongoose so other modules can use it
})
export class DatabaseModule {}
