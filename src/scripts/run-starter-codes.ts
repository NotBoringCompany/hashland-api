import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ReferralService } from 'src/referral/referral.service';
import { CreateStarterCodeDto } from 'src/referral/dto/starter-code.dto';

/**
 * Generate and add 10 starter codes to the database
 */
export async function generateStarterCodes() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const referralService = app.get(ReferralService);

  console.log('🚀 Generating 10 starter codes...');

  // Sample reward configurations
  const rewardConfigurations = [
    { effCredits: 0, hashBonus: 0 },
    { effCredits: 0, hashBonus: 0 },
    { effCredits: 0, hashBonus: 0 },
    { effCredits: 0, hashBonus: 0 },
    { effCredits: 0, hashBonus: 0 },
  ];

  const starterCodes = [];

  // Generate 10 starter codes with different configurations
  for (let i = 1; i <= 10; i++) {
    const rewardConfig = rewardConfigurations[i % rewardConfigurations.length];

    // Determine maxUses for this starter code
    const maxUses = 0;

    const createStarterCodeDto: CreateStarterCodeDto = {
      // Custom code for demonstration (optional in production)
      code: `adsgram${i}`,
      rewards: rewardConfig,
      // Set expiration to 360 days from now
      expiresAt: new Date(Date.now() + 360 * 24 * 60 * 60 * 1000),
      maxUses,
    };

    // Assign a creator for every second code (optional)
    if (i % 2 === 0) {
      // Replace with a valid operator ID from your database
      createStarterCodeDto.createdBy = null;
    }

    try {
      const result =
        await referralService.createStarterCode(createStarterCodeDto);
      starterCodes.push({
        ...result.data,
        maxUses,
      });

      console.log(
        `✅ Created starter code ${i}/10: ${result.data?.code} (Max uses: ${maxUses})`,
      );
    } catch (error) {
      console.error(`❌ Error creating starter code ${i}/10:`, error.message);
    }
  }

  console.log('✅ Finished generating starter codes:');
  console.table(
    starterCodes.map((code) => ({
      code: code?.code,
      isValid: code?.isValid,
      maxUses: code?.maxUses || 1,
      effCredits: code?.rewards?.effCredits || 0,
      hashBonus: code?.rewards?.hashBonus || 0,
    })),
  );

  await app.close();
}

// Run the function
generateStarterCodes().catch((err) => {
  console.error('❌ Error running function:', err);
  process.exit(1);
});
