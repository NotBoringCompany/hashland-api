import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HashbearService } from './hashbear.service';

@ApiTags('Hashbear')
@Controller('hashbear')
export class HashbearController {
  constructor(private readonly hashbearService: HashbearService) {}

  @ApiOperation({
    summary: 'Generate a collection of Hashbear NFTs',
    description:
      'Generates a specified number of Hashbear NFTs with unique traits and composite images.',
  })
  @Post('generate-collection')
  async generateCollection(@Body() { count }: { count: number }) {
    const results = [];

    for (let tokenId = 1; tokenId <= count; tokenId++) {
      try {
        // Generate traits
        const traits = await this.hashbearService.generateHashbear();

        // Composite image
        const imagePath = await this.hashbearService.compositeHashbear(
          traits,
          tokenId,
        );

        // // Generate and save metadata
        // const metadata = this.hashbearService.generateMetadata(traits, tokenId);
        // this.hashbearService.saveMetadata(metadata, tokenId);

        results.push({
          tokenId,
          traits,
          imagePath,
          // metadata,
        });
      } catch (error) {
        console.error(`Failed to generate token ${tokenId}:`, error);
      }
    }

    return {
      message: `Generated ${results.length} Hashbear NFTs`,
      results,
    };
  }
}
