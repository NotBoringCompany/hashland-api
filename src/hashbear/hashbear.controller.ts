import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HashbearService } from './hashbear.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('Hashbear')
@Controller('hashbear')
export class HashbearController {
  constructor(
    private readonly hashbearService: HashbearService,
    private readonly configService: ConfigService,
  ) {}

  @ApiOperation({
    summary: 'Generate a collection of Hashbear NFTs',
    description:
      'Generates a specified number of Hashbear NFTs with unique traits and composite images.',
  })
  @Post('generate-collection')
  async generateCollection(
    @Body('adminPassword') adminPassword: string,
    @Body('count') count: number,
  ) {
    return this.hashbearService.generateCollection(adminPassword, count);
  }
}
