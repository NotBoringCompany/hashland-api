import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShopDrill, ShopDrillSchema } from './schemas/shop-drill.schema';
import { ShopDrillService } from './shop-drill.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShopDrill.name, schema: ShopDrillSchema },
    ]), // Register ShopDrill schema
  ],
  controllers: [], // Expose API endpoints
  providers: [ShopDrillService], // Business logic for ShopDrill
  exports: [MongooseModule, ShopDrillService], // Allow usage in other modules
})
export class ShopDrillModule {}
