import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PoolService } from './pool.service';
import { Pool, PoolSchema } from './schemas/pool.schema';
import { PoolController } from './pool.controller.';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Pool.name, schema: PoolSchema }]), // Register Pool schema
  ],
  controllers: [PoolController], // Expose API endpoints
  providers: [PoolService], // Business logic for pools
  exports: [MongooseModule, PoolService], // Allow usage in other modules
})
export class PoolModule {}
