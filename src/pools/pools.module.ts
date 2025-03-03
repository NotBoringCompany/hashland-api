import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PoolsService } from './pools.service';
import { PoolsController } from './pools.controller';
import { Pool, PoolSchema } from './schemas/pool.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Pool.name, schema: PoolSchema }]), // Register Pool schema
  ],
  controllers: [PoolsController], // Expose API endpoints
  providers: [PoolsService], // Business logic for pools
  exports: [MongooseModule, PoolsService], // Allow usage in other modules
})
export class PoolsModule {}
