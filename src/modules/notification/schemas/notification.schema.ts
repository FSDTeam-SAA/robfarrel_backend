import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { NotificationType } from '../../../common/enums/notification-type.enum';

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: String, enum: NotificationType, required: true })
  type: NotificationType;

  @Prop({ required: true }) title: string;
  @Prop({ required: true }) message: string;

  /** id of the thing it is about: AI run, ticket, transaction */
  @Prop({ type: Types.ObjectId, default: null }) refId?: Types.ObjectId;

  @Prop({ default: false }) isRead: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, isRead: 1 });
export type NotificationDocument = HydratedDocument<Notification>;