import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AllowedChain } from 'src/common/enums/chain.enum';

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
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
  })
  _id: Types.ObjectId;

  /**
   * The operator's database ID.
   */
  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'Operators' })
  operatorId: Types.ObjectId;

  /**
   * The operator's wallet address.
   */
  @Prop({ required: true, index: true })
  address: string;

  /**
   * The chain this wallet was linked on.
   */
  @Prop({ required: true, enum: AllowedChain })
  chain: string;

  /**
   * The signature to verify that `address` is owned by the operator.
   */
  @Prop({ required: true })
  signature: string;

  /**
   * The signature message that accompanied the signature.
   */
  @Prop()
  signatureMessage: string;
}

/**
 * Generate the Mongoose schema for OperatorWallet.
 */
export const OperatorWalletSchema =
  SchemaFactory.createForClass(OperatorWallet);
