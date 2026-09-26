import {
  IsEnum,
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { SupportTopic } from '../../../common/enums/support-topic.enum';
import { SupportPriority } from '../../../common/enums/support-priority.enum';
import { SupportStatus } from '../../../common/enums/support-status.enum';

export class CreateTicketDto {
  @IsEnum(SupportTopic)
  topic: SupportTopic;

  @ValidateIf((o) => o.topic === SupportTopic.OTHERS)
  @IsString()
  @IsNotEmpty()
  customTopic?: string;

  @IsString() @IsNotEmpty() subject: string;
  @IsString() @IsNotEmpty() description: string;

  @IsEnum(SupportPriority)
  priority: SupportPriority;
}

export class AddReplyDto {
  @IsString() @IsNotEmpty() message: string;
}

export class UpdateTicketStatusDto {
  @IsEnum(SupportStatus)
  status: SupportStatus;
}

export class GetTicketsQueryDto {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsEnum(SupportStatus) status?: SupportStatus;
}