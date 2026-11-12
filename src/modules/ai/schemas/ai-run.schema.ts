import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export const AI_RUN_STATUSES = [
  'pending',
  'running',
  'completed',
  'partial',
  'failed',
] as const;
export type AiRunStatus = (typeof AI_RUN_STATUSES)[number];

/**
 * One call to the AI microservice. Its _id is sent as the AI `request_id`,
 * so a callback always finds its run and a retried callback is idempotent.
 */
@Schema({ timestamps: true })
export class AiRun {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  /** AI module key, e.g. market, fit_score, visualize, property_match */
  @Prop({ required: true, index: true }) module: string;

  @Prop({
    type: String,
    enum: AI_RUN_STATUSES,
    default: 'pending',
    index: true,
  })
  status: AiRunStatus;

  @Prop({ type: Types.ObjectId, ref: 'PropertyAnalysis', default: null })
  propertyAnalysis?: Types.ObjectId;

  /** AI async job id (visualize, analysis_run) */
  @Prop({ default: null, index: true }) jobId?: string;

  /** Exact payload sent to the AI service */
  @Prop({ type: MongooseSchema.Types.Mixed, default: null }) request?: any;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null }) results?: any;

  /** AI module errors ({ module, code, message, retryable }); `errors` is reserved by Mongoose */
  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] }) aiErrors: any[];

  /** Per-provider-call usage reported by the AI service */
  @Prop({ type: [MongooseSchema.Types.Mixed], default: [] }) usage: any[];

  @Prop({ default: 0 }) totalTokens: number;

  /** Set once by the credit burn; null means not charged yet */
  @Prop({ type: Number, default: null }) creditsCharged?: number | null;

  @Prop({ default: null }) configVersion?: string;
  @Prop({ default: null }) promptVersion?: string;
  @Prop({ default: null }) completedAt?: Date;
}

export const AiRunSchema = SchemaFactory.createForClass(AiRun);
export type AiRunDocument = HydratedDocument<AiRun>;
