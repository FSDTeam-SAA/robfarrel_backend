import { Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationQueryDto } from './dto/notification.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  list(@CurrentUser('_id') userId: string, @Query() query: NotificationQueryDto) {
    return this.notificationService.list(String(userId), query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser('_id') userId: string) {
    return this.notificationService.getUnreadCount(String(userId));
  }

  @Put('read-all')
  markAllRead(@CurrentUser('_id') userId: string) {
    return this.notificationService.markAllRead(String(userId));
  }

  @Put(':id/read')
  markRead(@CurrentUser('_id') userId: string, @Param('id') id: string) {
    return this.notificationService.markRead(String(userId), id);
  }

  @Delete(':id')
  remove(@CurrentUser('_id') userId: string, @Param('id') id: string) {
    return this.notificationService.remove(String(userId), id);
  }
}