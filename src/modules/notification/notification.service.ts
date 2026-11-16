import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { NotificationType } from '../../common/enums/notification-type.enum';
import { NotificationQueryDto } from './dto/notification.dto';
import { createMeta, createPaginationInfo } from '../../common/utils/pagination.util';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { RoleType } from '../../common/enums/role.enum';
export interface CreateNotificationInput {
  user: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  refId?: string | Types.ObjectId | null;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

   constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}
  /** Called by other modules. Never throws, so a failed notification can't break a payment or AI run. */
  async create(input: CreateNotificationInput) {
    try {
      await this.notificationModel.create(input);
    } catch (err) {
      this.logger.error(`Notification failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** One notification per admin account. Never throws. */
  async notifyAdmins(input: Omit<CreateNotificationInput, 'user'>) {
    try {
      const admins = await this.userModel.find({ role: RoleType.ADMIN }).select('_id').lean();
      if (!admins.length) return;
      await this.notificationModel.insertMany(
        admins.map((admin) => ({ ...input, user: admin._id })),
      );
    } catch (err) {
      this.logger.error(`Admin notification failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  async list(userId: string, query: NotificationQueryDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const user = new Types.ObjectId(userId);
    const filter: Record<string, any> = { user };
    if (query.filter === 'unread') filter.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.notificationModel.countDocuments(filter),
      this.notificationModel.countDocuments({ user, isRead: false }),
    ]);

    return {
      message: 'Notifications fetched successfully',
      meta: createMeta(page, limit, total),
      data: {
        unreadCount,
        notifications,
        paginationInfo: createPaginationInfo(page, limit, total),
      },
    };
  }

  async getUnreadCount(userId: string) {
    const unreadCount = await this.notificationModel.countDocuments({
      user: new Types.ObjectId(userId),
      isRead: false,
    });
    return { message: 'Unread count fetched successfully', data: { unreadCount } };
  }

  async markRead(userId: string, id: string) {
    this.assertValidId(id);
    const notification = await this.notificationModel.findOneAndUpdate(
      { _id: id, user: userId },
      { isRead: true },
      { new: true },
    );
    if (!notification) throw new HttpException('Notification not found', HttpStatus.NOT_FOUND);
    return { message: 'Notification marked as read', data: notification };
  }

  async markAllRead(userId: string) {
    const result = await this.notificationModel.updateMany(
      { user: userId, isRead: false },
      { isRead: true },
    );
    return { message: 'All notifications marked as read', data: { updated: result.modifiedCount } };
  }

  async remove(userId: string, id: string) {
    this.assertValidId(id);
    const deleted = await this.notificationModel.findOneAndDelete({ _id: id, user: userId });
    if (!deleted) throw new HttpException('Notification not found', HttpStatus.NOT_FOUND);
    return { message: 'Notification deleted successfully', data: null };
  }

  private assertValidId(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpException('Invalid notification id', HttpStatus.BAD_REQUEST);
    }
  }
}