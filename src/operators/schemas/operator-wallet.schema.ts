import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AllowedChain } from 'src/common/enums/chain.enum';
import { ApiProperty } from '@nestjs/swagger';

/**
 * `OperatorWallet` represents a wallet linked by an operator to calculate asset equity, amongst other things.
 */
@Schema({
  timestamps: true,
  collection: 'OperatorWallets',
  versionKey: false,
})
export class OperatorWallet extends Document {
  /**
   * The database ID of the operator wallet.
   */
  @ApiProperty({
    description: 'The database ID of the operator wallet',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
  })
  _id: Types.ObjectId;

  /**
   * The operator's database ID.
   */
  @ApiProperty({
    description: 'The database ID of the operator who owns this wallet',
    example: '507f1f77bcf86cd799439012',
  })
  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'Operators' })
  operatorId: Types.ObjectId;

  /**
   * The operator's wallet address.
   */
  @ApiProperty({
    description: 'The wallet address',
    example: 'EQDrLq-X6jKZNHAScgghh0h1iog3StK71zfAxNOYVlPP70wY',
  })
  @Prop({ required: true, index: true })
  address: string;

  /**
   * The chain this wallet was linked on.
   */
  @ApiProperty({
    description: 'The blockchain network this wallet belongs to',
    example: 'TON',
    enum: AllowedChain,
  })
  @Prop({ required: true, enum: AllowedChain })
  chain: string;

  /**
   * The signature to verify that `address` is owned by the operator.
   */
  @ApiProperty({
    description: 'The signature used to verify wallet ownership',
    example: '0xabcdef12345...',
  })
  @Prop({ required: true })
  signature: string;

  /**
   * The signature message that accompanied the signature.
   */
  @ApiProperty({
    description: 'The message that was signed',
    example: 'I am linking this wallet to my Hashland account',
  })
  @Prop()
  signatureMessage: string;

  /**
   * The timestamp when the wallet was created
   */
  @ApiProperty({
    description: 'The timestamp when the wallet was created',
    example: '2024-03-19T12:00:00.000Z',
  })
  createdAt: Date;

  /**
   * The timestamp when the wallet was last updated
   */
  @ApiProperty({
    description: 'The timestamp when the wallet was last updated',
    example: '2024-03-19T12:00:00.000Z',
  })
  updatedAt: Date;
}

/**
 * Generate the Mongoose schema for OperatorWallet.
 */
export const OperatorWalletSchema =
  SchemaFactory.createForClass(OperatorWallet);
