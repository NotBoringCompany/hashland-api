// src/mixpanel/mixpanel.module.ts
import { Module } from '@nestjs/common';
import { MixpanelService } from './mixpanel.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [MixpanelService],
  exports: [MixpanelService], // Allows use in other modules
})
export class MixpanelModule {}
