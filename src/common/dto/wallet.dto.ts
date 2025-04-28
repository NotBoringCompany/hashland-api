import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  ValidateNested,
  ValidateIf,
  IsNumber,
  IsHexadecimal,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiResponse } from 'src/common/dto/response.dto';
import { Types } from 'mongoose';

/**
 * DTO for domain in TON proof
 */
class TonProofDomainDto {
  @ApiProperty({
    description: 'Length of domain in bytes',
    example: 17,
  })
  @IsNumber()
  lengthBytes: number;

  @ApiProperty({
    description: 'Domain value',
    example: 'hashland.ton.app',
  })
  @IsString()
  value: string;
}

/**
 * DTO for proof data in TON proof
 */
class TonProofDataDto {
  @ApiProperty({
    description: 'Timestamp of the proof',
    example: 1646146412,
  })
  @IsNumber()
  timestamp: number;

  @ApiProperty({
    description: 'Domain information',
  })
  @Type(() => TonProofDomainDto)
  domain: TonProofDomainDto;

  @ApiProperty({
    description: 'Signature value (base64 encoded)',
    example: 'base64-encoded-signature',
  })
  @IsString()
  signature: string;

  @ApiProperty({
    description: 'Payload value',
    example: 'payload-token-value',
  })
  @IsString()
  payload: string;

  @ApiProperty({
    description: 'State init (base64)',
    example: 'base64-encoded-state-init',
  })
  @IsString()
  state_init: string;
}

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
      signature: 'base64-encoded-signature',
      payload: 'payload-token-value',
      state_init: 'base64-encoded-state-init',
    },
  })
  @ValidateNested()
  @Type(() => TonProofDataDto)
  proof: TonProofDataDto;

  @ApiProperty({
    description: 'TON wallet address',
    example: 'EQAbc123...',
  })
  @IsString()
  @IsNotEmpty()
  tonAddress: string;

  @ApiProperty({
    description: 'Public key associated with the TON wallet (hex)',
    example: '39d0939e8fa4c61854263d8cc71de4d6c90af169958d30f11fafefec1f428ce0',
  })
  @IsString()
  @IsNotEmpty()
  @IsHexadecimal()
  public_key: string;
}

/**
 * DTO for generating a TON proof payload
 */
export class GenerateTonProofPayloadDto {
  @ApiProperty({
    description: 'Optional context information for the payload',
    example: { user_id: '123456' },
    required: false,
  })
  @IsOptional()
  context?: Record<string, any>;
}

/**
 * Response data for TON proof payload
 */
export class TonProofPayloadResponseData {
  @ApiProperty({
    description: 'Generated payload token for TON proof',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  payload: string;
}

/**
 * Response for TON proof payload generation
 */
export class TonProofPayloadResponse extends ApiResponse<TonProofPayloadResponseData> {
  constructor(data: TonProofPayloadResponseData) {
    super(200, 'TON proof payload generated', data);
  }
}

/**
 * DTO for verifying TON proof
 */
export class VerifyTonProofDto {
  @ApiProperty({
    description: 'TON wallet address',
    example: 'EQAbc123...',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    description: 'Public key associated with the TON wallet (hex)',
    example: '39d0939e8fa4c61854263d8cc71de4d6c90af169958d30f11fafefec1f428ce0',
  })
  @IsString()
  @IsHexadecimal()
  @IsNotEmpty()
  public_key: string;

  @ApiProperty({
    description: 'TON proof data',
  })
  @ValidateNested()
  @Type(() => TonProofDataDto)
  proof: TonProofDataDto;
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
    required: false,
  })
  @IsString()
  @ValidateIf((o) => !o.tonProof)
  @IsNotEmpty({
    message: 'Signature is required when tonProof is not provided',
  })
  signature: string;

  @ApiProperty({
    description: 'Message that was signed',
    example: 'Hashland authentication request for address EQAbc123...',
    required: false,
  })
  @IsString()
  @ValidateIf((o) => !o.tonProof)
  @IsNotEmpty({
    message: 'Signature message is required when tonProof is not provided',
  })
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
  operatorId?: Types.ObjectId;

  @ApiProperty({
    description: 'Wallet address',
    example: 'EQAbc123...',
  })
  address?: string;

  @ApiProperty({
    description: 'Blockchain network',
    example: 'TON',
  })
  chain?: string;
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

/**
 * DTO for validating a wallet signature
 */
export class ValidateSignatureDto {
  @ApiProperty({
    description: 'Signature to verify',
    example: '0x123abc...',
  })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({
    description: 'Message that was signed',
    example:
      'Hashland authentication request for address EQAbc123...\nNonce: 1234abcd\nTimestamp: 1646146412',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'Wallet address',
    example: 'EQAbc123...',
  })
  @IsString()
  @IsNotEmpty()
  address: string;
}

/**
 * Response data for TON API status
 */
export class TonApiStatusResponseData {
  @ApiProperty({
    description: 'Connection status',
    example: 'connected',
    enum: ['connected', 'error'],
  })
  status: string;

  @ApiProperty({
    description: 'TON API endpoint URL',
    example: 'https://toncenter.com/api/v2/jsonRPC',
  })
  endpoint: string;
}

/**
 * Response for TON API status
 */
export class TonApiStatusResponse extends ApiResponse<TonApiStatusResponseData> {
  constructor(data: TonApiStatusResponseData) {
    super(200, 'TON API connection status', data);
  }
}
