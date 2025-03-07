import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiResponse } from 'src/common/dto/response.dto';
import { Types } from 'mongoose';

/**
 * DTO for TON proof from Telegram wallet
 */
export class TonProofDto {
  @ApiProperty({
    description: 'Proof data containing signature and payload',
    example: {
      timestamp: 1646146412,
      domain: {
        lengthBytes: 17,
        value: 'hashland.ton.app',
      },
      signature: '0x123abc...',
      payload: '0x456def...',
    },
  })
  @ValidateNested()
  @Type(() => Object)
  proof: {
    timestamp: number;
    domain: {
      lengthBytes: number;
      value: string;
    };
    signature: string;
    payload: string;
  };

  @ApiProperty({
    description: 'TON wallet address',
    example: 'EQAbc123...',
  })
  @IsString()
  @IsNotEmpty()
  tonAddress: string;
}

/**
 * DTO for connecting a wallet to an operator
 */
export class ConnectWalletDto {
  @ApiProperty({
    description: 'Wallet address',
    example: 'EQAbc123...',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    description: 'Blockchain network',
    example: 'TON',
  })
  @IsString()
  @IsNotEmpty()
  chain: string;

  @ApiProperty({
    description: 'Signature to verify wallet ownership',
    example: '0x123abc...',
  })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({
    description: 'Message that was signed',
    example: 'Hashland authentication request for address EQAbc123...',
  })
  @IsString()
  @IsNotEmpty()
  signatureMessage: string;

  @ApiProperty({
    description: 'TON proof from Telegram wallet',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TonProofDto)
  tonProof?: TonProofDto;
}

/**
 * DTO for generating a proof challenge
 */
export class GenerateProofChallengeDto {
  @ApiProperty({
    description: 'Wallet address',
    example: 'EQAbc123...',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    description: 'Blockchain network',
    example: 'TON',
  })
  @IsString()
  @IsNotEmpty()
  chain: string;
}

/**
 * Response data for connected wallet
 */
export class ConnectedWalletResponseData {
  @ApiProperty({
    description: 'Wallet ID',
    example: '60d21b4667d0d8da05ee0462',
  })
  _id: Types.ObjectId;

  @ApiProperty({
    description: 'Operator ID',
    example: '60d21b4667d0d8da05ee0461',
  })
  operatorId: Types.ObjectId;

  @ApiProperty({
    description: 'Wallet address',
    example: 'EQAbc123...',
  })
  address: string;

  @ApiProperty({
    description: 'Blockchain network',
    example: 'TON',
  })
  chain: string;
}

/**
 * Response for connected wallet
 */
export class ConnectedWalletResponse extends ApiResponse<ConnectedWalletResponseData> {
  constructor(data: ConnectedWalletResponseData) {
    super(200, 'Wallet connected successfully', data);
  }
}

/**
 * Response data for proof challenge
 */
export class ProofChallengeResponseData {
  @ApiProperty({
    description: 'Challenge message to sign',
    example:
      'Hashland authentication request for address EQAbc123...\nNonce: 1234abcd\nTimestamp: 1646146412',
  })
  message: string;

  @ApiProperty({
    description: 'Nonce used in the challenge',
    example: '1234abcd',
  })
  nonce: string;
}

/**
 * Response for proof challenge
 */
export class ProofChallengeResponse extends ApiResponse<ProofChallengeResponseData> {
  constructor(data: ProofChallengeResponseData) {
    super(200, 'Proof challenge generated', data);
  }
}

/**
 * Response data for wallet validation
 */
export class WalletValidationResponseData {
  @ApiProperty({
    description: 'Validation result',
    example: true,
  })
  isValid: boolean;
}

/**
 * Response for wallet validation
 */
export class WalletValidationResponse extends ApiResponse<WalletValidationResponseData> {
  constructor(data: WalletValidationResponseData) {
    super(200, 'Wallet validation completed', data);
  }
}
