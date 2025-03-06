import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Drill, DrillSchema } from './schemas/drill.schema';
import { DrillService } from './drill.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Drill.name, schema: DrillSchema }]),
  ],
  providers: [DrillService],
  exports: [DrillService],
})
export class DrillModule {}
