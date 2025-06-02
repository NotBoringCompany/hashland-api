import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AuctionSeeder } from '../auction/seeders/auction.seeder';
import { AuctionStatus } from '../auction/schemas/auction.schema';

/**
 * Script to seed auction system data
 */
async function runAuctionSeeder() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const auctionSeeder = app.get(AuctionSeeder);

  try {
    console.log('🚀 Starting auction system seeding...');

    // Seed all auction data
    await auctionSeeder.seedAll();

    console.log('✅ Auction seeding completed successfully!');
    console.log(
      '📊 You can now test the auction endpoints with realistic data',
    );

    // Optional: Seed additional specific status auctions
    console.log('\n🎯 Seeding additional active auctions for testing...');
    await auctionSeeder.seedAuctionsByStatus(AuctionStatus.AUCTION_ACTIVE, 3);

    console.log(
      '\n🎯 Seeding additional whitelist-open auctions for testing...',
    );
    await auctionSeeder.seedAuctionsByStatus(AuctionStatus.WHITELIST_OPEN, 2);

    console.log('\n🎉 All seeding operations completed!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

/**
 * Run the seeder if this file is executed directly
 */
if (require.main === module) {
  runAuctionSeeder().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { runAuctionSeeder };
