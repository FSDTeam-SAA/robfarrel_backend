import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Credit burn ledger: one row per charged AI run. */
@Schema({ timestamps: true })
export class CreditUsage {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AiRun', required: true, unique: true })
  aiRun: Types.ObjectId;

  @Prop({ required: true }) module: string;

  /** total_tokens reported by the AI service for the run */
  @Prop({ required: true }) totalTokens: number;

  /** Burn rate in force when the run was charged */
  @Prop({ required: true }) tokensPerCredit: number;

  /** ceil(totalTokens / tokensPerCredit) */
  @Prop({ required: true }) creditsBurned: number;

  /** Credits actually deducted; less than creditsBurned only when the balance ran out */
  @Prop({ required: true }) creditsDeducted: number;

  @Prop({ required: true }) balanceBefore: number;
  @Prop({ required: true }) balanceAfter: number;
}

export const CreditUsageSchema = SchemaFactory.createForClass(CreditUsage);
CreditUsageSchema.index({ createdAt: -1 });
export type CreditUsageDocument = HydratedDocument<CreditUsage>;
