import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { AllowedChain } from '../enums/chain.enum';

/**
 * DTO for authenticating with a wallet
 */
export class WalletLoginDto {
  @ApiProperty({
    description: 'Wallet address',
    example: '0x1234567890abcdef1234567890abcdef12345678',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    description: 'Signature to verify wallet ownership',
    example:
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b',
  })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({
    description: 'Message that was signed',
    example:
      'Hashland authentication request for address 0x1234...5678\nNonce: abcd1234\nTimestamp: 1646146412',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'Blockchain network',
    example: 'ETH',
    enum: AllowedChain,
  })
  @IsString()
  @IsNotEmpty()
  chain: string;
}
