import { Module } from '@nestjs/common';
import { HashbearService } from './hashbear.service';

@Module({
  imports: [],
  providers: [HashbearService],
  exports: [HashbearService], // ✅ Allow use in other modules
})
export class HashbearModule {}
