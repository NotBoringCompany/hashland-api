import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Schema for starter codes that can be used as referrals
 */
@Schema({
  timestamps: true,
  collection: 'StarterCodes',
  versionKey: false,
})
export class StarterCode extends Document {
  /**
   * The database ID of the starter code record
   */
  @ApiProperty({
    description: 'The database ID of the starter code record',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
    primaryKey: true,
  })
  _id: Types.ObjectId;

  /**
   * The unique starter code
   */
  @ApiProperty({
    description: 'The unique starter code',
    example: 'STARTER123',
  })
  @Prop({ type: String, required: true, unique: true, index: true })
  code: string;

  /**
   * The operator ID who created this starter code (optional)
   */
  @ApiProperty({
    description: 'The operator who created this starter code',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({ type: Types.ObjectId, ref: 'Operators', index: true })
  createdBy: Types.ObjectId;

  /**
   * Whether this starter code has been used
   */
  @ApiProperty({
    description: 'Whether this starter code has been used',
    example: false,
  })
  @Prop({ type: Boolean, default: false })
  isUsed: boolean;

  /**
   * The operator ID who used this starter code (optional)
   */
  @ApiProperty({
    description: 'The operator who used this starter code',
    example: '507f1f77bcf86cd799439011',
  })
  @Prop({ type: Types.ObjectId, ref: 'Operators', index: true })
  usedBy: Types.ObjectId;

  /**
   * Rewards configuration for this starter code
   */
  @ApiProperty({
    description: 'Rewards configuration for this starter code',
    example: {
      effCredits: 150,
      hashBonus: 75,
    },
  })
  @Prop({
    type: {
      effCredits: { type: Number, default: 0 },
      hashBonus: { type: Number, default: 0 },
    },
    default: {},
  })
  rewards: {
    effCredits?: number;
    hashBonus?: number;
  };

  /**
   * Optional expiration date for this starter code
   */
  @ApiProperty({
    description: 'Optional expiration date for this starter code',
    example: '2024-12-31T23:59:59.999Z',
  })
  @Prop({ type: Date })
  expiresAt: Date;

  /**
   * The timestamp when the record was created
   */
  @ApiProperty({
    description: 'The timestamp when the record was created',
    example: '2024-03-19T12:00:00.000Z',
  })
  createdAt: Date;

  /**
   * The timestamp when the record was last updated
   */
  @ApiProperty({
    description: 'The timestamp when the record was last updated',
    example: '2024-03-19T12:00:00.000Z',
  })
  updatedAt: Date;
}

/**
 * Generate the Mongoose schema for StarterCode
 */
export const StarterCodeSchema = SchemaFactory.createForClass(StarterCode);
