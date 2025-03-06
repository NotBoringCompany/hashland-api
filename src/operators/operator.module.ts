import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Operator, OperatorSchema } from './schemas/operator.schema';
import { OperatorService } from './operator.service';
import { PoolModule } from 'src/pools/pool.module';
import { PoolOperatorModule } from 'src/pools/pool-operator.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Operator.name, schema: OperatorSchema },
    ]), // Register Operator schema
    PoolModule,
    PoolOperatorModule,
  ],
  controllers: [], // Expose API endpoints
  providers: [OperatorService], // Business logic for Operators
  exports: [MongooseModule, OperatorService], // Allow usage in other modules
})
export class OperatorModule {}
