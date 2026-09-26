import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class CreditPlan {
  @Prop({ required: true, trim: true }) title: string;
  @Prop({ required: true }) actualPrice: number;
  @Prop({ required: true }) discountedPrice: number;
  @Prop({ required: true }) creditVolume: number;
  @Prop({ default: '' }) description: string;
  @Prop({ default: '' }) promoLabel: string;
  @Prop({ default: false }) isFeatured: boolean;
}

export const CreditPlanSchema = SchemaFactory.createForClass(CreditPlan);
export type CreditPlanDocument = HydratedDocument<CreditPlan>;