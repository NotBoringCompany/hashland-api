import { Module } from '@nestjs/common';
import { TonService } from './ton.service';

@Module({
  imports: [],
  controllers: [], // Expose API endpoints
  providers: [TonService], // Business logic for TONService
  exports: [TonService], // Allow usage in other modules
})
export class TonModule {}
