// src/mixpanel/mixpanel.module.ts
import { Module } from '@nestjs/common';
import { MixpanelService } from './mixpanel.service';

@Module({
  providers: [MixpanelService],
  exports: [MixpanelService], // Allows use in other modules
})
export class MixpanelModule {}
