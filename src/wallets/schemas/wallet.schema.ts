import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { WalletConnectionStatus } from '../interfaces/wallet-connection-types';

@Schema({ timestamps: true, collection: 'Wallet', versionKey: false })
export class Wallet extends Document {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  address: string;

  @Prop({ required: true, default: Date.now })
  connectedAt: Date;

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata: Record<string, any>;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Operator',
    required: true,
  })
  operatorId: MongooseSchema.Types.ObjectId;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);

// Create indexes for faster queries
WalletSchema.index({ address: 1, type: 1, operatorId: 1 }, { unique: true });
WalletSchema.index({ operatorId: 1 });

@Schema({
  timestamps: true,
  collection: 'WalletConnectionEvent',
  versionKey: false,
})
export class WalletConnectionEvent extends Document {
  @Prop({ required: true })
  walletId: string;

  @Prop({ required: true })
  operatorId: string;

  @Prop({ required: true, enum: ['connect', 'disconnect', 'validate'] })
  eventType: string;

  @Prop({ required: true, default: Date.now })
  timestamp: Date;

  @Prop({
    required: true,
    enum: Object.values(WalletConnectionStatus),
    default: WalletConnectionStatus.PENDING,
  })
  status: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata: Record<string, any>;
}

export const WalletConnectionEventSchema = SchemaFactory.createForClass(
  WalletConnectionEvent,
);

// Create indexes for faster queries
WalletConnectionEventSchema.index({ walletId: 1, timestamp: -1 });
WalletConnectionEventSchema.index({ operatorId: 1, timestamp: -1 });
