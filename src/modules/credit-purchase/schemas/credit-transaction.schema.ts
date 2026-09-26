import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class CreditTransaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CreditPlan', required: true })
  plan: Types.ObjectId;

  @Prop({ required: true }) amountPaid: number;
  @Prop({ required: true }) creditsAdded: number;

  @Prop({ enum: ['pending', 'completed', 'failed'], default: 'pending' })
  status: string;

  @Prop({ default: null }) stripeSessionId?: string;
}

export const CreditTransactionSchema = SchemaFactory.createForClass(CreditTransaction);
export type CreditTransactionDocument = HydratedDocument<CreditTransaction>;