import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PoolOperatorService } from './pool-operator.service';
import {
  PoolOperator,
  PoolOperatorSchema,
} from './schemas/pool-operator.schema';
import { PoolModule } from './pool.module';
import { PoolOperatorController } from './pool-operator.controller';
import { MixpanelModule } from 'src/mixpanel/mixpanel.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PoolOperator.name, schema: PoolOperatorSchema },
    ]), // Register Pool schema
    PoolModule,
    MixpanelModule,
  ],
  controllers: [PoolOperatorController], // Expose API endpoints
  providers: [PoolOperatorService], // Business logic for pool operators
  exports: [
    MongooseModule.forFeature([
      { name: PoolOperator.name, schema: PoolOperatorSchema },
    ]),
    PoolOperatorService,
  ], // Allow usage in other modules
})
export class PoolOperatorModule {}
