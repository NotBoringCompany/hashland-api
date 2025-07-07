import { Module } from '@nestjs/common';
import { HashbearService } from './hashbear.service';
import { HashbearController } from './hashbear.controller';

@Module({
  imports: [],
  providers: [HashbearService],
  exports: [HashbearService], // ✅ Allow use in other modules
  controllers: [HashbearController],
})
export class HashbearModule {}
