import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Drill, DrillSchema } from './schemas/drill.schema';
import { DrillService } from './drill.service';
import {
  Operator,
  OperatorSchema,
} from 'src/operators/schemas/operator.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Drill.name, schema: DrillSchema },
      { name: Operator.name, schema: OperatorSchema },
    ]),
  ],
  providers: [DrillService],
  exports: [MongooseModule, DrillService],
})
export class DrillModule {}
