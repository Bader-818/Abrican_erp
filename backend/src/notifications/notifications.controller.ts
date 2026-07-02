import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { AuthOnly } from '../common/decorators/auth-only.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsQueryDto } from './dto/notifications-query.dto';
import { NotificationsService } from './notifications.service';

// Every route is scoped to the authenticated user's own notifications.
@AuthOnly()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string, @Query() query: NotificationsQueryDto) {
    return this.notificationsService.findAllForUser(userId, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser('id') userId: string) {
    return this.notificationsService.unreadCount(userId);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Patch(':id/read')
  markAsRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.markAsRead(userId, id);
  }
}
