import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SupportTopic } from '../../../common/enums/support-topic.enum';
import { SupportStatus } from '../../../common/enums/support-status.enum';
import { SupportPriority } from '../../../common/enums/support-priority.enum';
import { RoleType } from '../../../common/enums/role.enum';

@Schema({ _id: false, timestamps: { createdAt: true, updatedAt: false } })
export class SupportReply {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({ type: String, enum: RoleType, required: true })
  senderRole: RoleType;

  @Prop({ required: true }) message: string;
}
export const SupportReplySchema = SchemaFactory.createForClass(SupportReply);

@Schema({ timestamps: true })
export class HelpSupport {
  @Prop({ required: true, unique: true, index: true })
  ticketNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: String, enum: SupportTopic, required: true })
  topic: SupportTopic;

  @Prop({ default: '' }) customTopic?: string;

  @Prop({ required: true }) subject: string;
  @Prop({ required: true }) description: string;

  @Prop({ type: String, enum: SupportPriority, default: SupportPriority.NORMAL })
  priority: SupportPriority;

  @Prop({ default: '' }) attachmentUrl?: string;

  @Prop({ type: String, enum: SupportStatus, default: SupportStatus.OPEN })
  status: SupportStatus;

  @Prop({ type: [SupportReplySchema], default: [] })
  replies: SupportReply[];
}

export const HelpSupportSchema = SchemaFactory.createForClass(HelpSupport);
export type HelpSupportDocument = HydratedDocument<HelpSupport>;