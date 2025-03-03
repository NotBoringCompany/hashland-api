import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShopDrill, ShopDrillSchema } from './schemas/shop-drill.schema';
import { ShopDrillsService } from './shop-drill.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShopDrill.name, schema: ShopDrillSchema },
    ]), // Register ShopDrill schema
  ],
  controllers: [], // Expose API endpoints
  providers: [ShopDrillsService], // Business logic for ShopDrills
  exports: [MongooseModule, ShopDrillsService], // Allow usage in other modules
})
export class ShopDrillsModule {}
