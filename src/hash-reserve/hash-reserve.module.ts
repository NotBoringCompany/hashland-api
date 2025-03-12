import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HashReserveService } from './hash-reserve.service';
import { HASHReserve, HashReserveSchema } from './schemas/hash-reserve.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HASHReserve.name, schema: HashReserveSchema },
    ]),
  ],
  providers: [HashReserveService],
  exports: [HashReserveService], // ✅ Allow use in other modules
})
export class HashReserveModule {}
