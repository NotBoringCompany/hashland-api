import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { GAME_CONSTANTS } from 'src/common/constants/game.constants';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

/**
 * `Operator` represents users who participate in drilling for $HASH.
 */
@Schema({ timestamps: true, collection: 'Operators', versionKey: false })
export class Operator extends Document {
  /**
   * The database ID of the operator.
   */
  @ApiProperty({
    description: 'The database ID of the operator',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
    primaryKey: true,
  })
  _id: Types.ObjectId;

  /**
   * A unique username accompanying the operator.
   */
  @ApiProperty({
    description: 'A unique username for the operator',
    example: 'hashland_operator',
  })
  @Prop({ required: true, unique: true, index: true })
  username: string;

  /**
   * The operator's latest asset equity value (in USD).
   *
   * This includes asset holdings like TON, USDT, USDC and other tokens.
   */
  @ApiProperty({
    description: "The operator's latest asset equity value in USD",
    example: 1250.5,
  })
  @Prop({ required: true, default: 0 })
  assetEquity: number;

  /**
   * The total cumulative EFF from all drills owned by the operator.
   *
   * This is essentially the 'mining power' equivalent of the operator.
   */
  @ApiProperty({
    description:
      'The total cumulative EFF from all drills owned by the operator',
    example: 750,
  })
  @Prop({ required: true, default: 0 })
  cumulativeEff: number;

  /**
   * A multiplier that's applied to the operator's drills' `actualEff`.
   *
   * This is decided by the operator's asset equity.
   */
  @ApiProperty({
    description: "A multiplier applied to the operator's drills' actual EFF",
    example: 1.5,
  })
  @Prop({ required: true, default: 1 })
  effMultiplier: number;

  /**
   * The maximum fuel capacity of the operator's drills.
   */
  @ApiProperty({
    description: "The maximum fuel capacity of the operator's drills",
    example: 100,
  })
  @Prop({
    required: true,
    default: GAME_CONSTANTS.FUEL.OPERATOR_STARTING_FUEL,
  })
  maxFuel: number;

  /**
   * The current fuel capacity of the operator's drills.
   */
  @ApiProperty({
    description: "The current fuel capacity of the operator's drills",
    example: 75,
  })
  @Prop({
    required: true,
    default: GAME_CONSTANTS.FUEL.OPERATOR_STARTING_FUEL,
  })
  currentFuel: number;

  /**
   * The max number of active drills (drills that can extract $HASH) allowed.
   */
  @ApiProperty({
    description: 'The max number of active drills allowed',
    example: 5,
  })
  @Prop({
    required: true,
    default: GAME_CONSTANTS.DRILLS.INITIAL_ACTIVE_DRILLS_ALLOWED,
  })
  maxActiveDrillsAllowed: number;

  /**
   * The total $HASH earned by the operator across all sessions so far.
   */
  @ApiProperty({
    description: 'The total $HASH earned by the operator across all sessions',
    example: 5000,
  })
  @Prop({ required: true, default: 0 })
  totalEarnedHASH: number;

  /**
   * An optional Telegram profile. Should only be set if the operator logs in via Telegram.
   */
  @ApiProperty({
    description: "The operator's Telegram profile (optional)",
    required: false,
    example: {
      tgId: '123456789',
      tgUsername: 'username',
    },
  })
  @Prop({
    type: {
      tgId: { type: String, required: true, index: true },
      tgUsername: { type: String, required: true },
    },
    required: false,
    default: null,
  })
  tgProfile?: {
    tgId: string;
    tgUsername: string;
  } | null;

  /**
   * An optional wallet profile. Should only be set if the operator was created via wallet authentication.
   */
  @ApiProperty({
    description: "The operator's primary wallet profile (optional)",
    required: false,
    example: {
      address: '0x1234567890abcdef1234567890abcdef12345678',
      chain: 'ETH',
    },
  })
  @Prop({
    type: {
      address: { type: String, required: true, index: true },
      chain: { type: String, required: true },
    },
    required: false,
    default: null,
  })
  walletProfile?: {
    address: string;
    chain: string;
  } | null;

  /**
   * The timestamp when the operator was created
   */
  @ApiProperty({
    description: 'The timestamp when the operator was created',
    example: '2024-03-19T12:00:00.000Z',
  })
  createdAt: Date;

  /**
   * The timestamp when the operator was last updated
   */
  @ApiProperty({
    description: 'The timestamp when the operator was last updated',
    example: '2024-03-19T12:00:00.000Z',
  })
  updatedAt: Date;
}

/**
 * Generate the Mongoose schema for Operator.
 */
export const OperatorSchema = SchemaFactory.createForClass(Operator);
