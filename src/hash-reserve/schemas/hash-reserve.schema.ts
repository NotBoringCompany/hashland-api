import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * `HASHReserve` represents the total amount of $HASH that is reserved for the game.
 *
 * Inflows can come from $HASH that is not rewarded to operators due to integrity checks, or from special events, etc.
 * This sort of acts as an 'integrity fund'.
 */
@Schema({ collection: 'HashReserve', versionKey: false })
export class HASHReserve extends Document {
  /**
   * The unique identifier for the HASHReserve instance.
   */
  @Prop({ type: Types.ObjectId, default: () => new Types.ObjectId() })
  _id: Types.ObjectId;

  /**
   * The total amount of $HASH that is reserved for the game.
   */
  @Prop({ type: Number, required: true, default: 0 })
  totalHASH: number;
}

export const HashReserveSchema = SchemaFactory.createForClass(HASHReserve);
