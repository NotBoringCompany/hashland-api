import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Drill, DrillSchema } from './schemas/drill.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Drill.name, schema: DrillSchema }]),
  ],
  exports: [
    MongooseModule.forFeature([{ name: Drill.name, schema: DrillSchema }]),
  ],
})
export class DrillModule {}
