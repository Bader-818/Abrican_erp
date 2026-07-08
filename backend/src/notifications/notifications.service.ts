import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/helpers/pagination.helper';
import { NotificationsQueryDto } from './dto/notifications-query.dto';

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: CreateNotificationParams) {
    return this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        relatedEntityType: params.relatedEntityType,
        relatedEntityId: params.relatedEntityId,
      },
    });
  }

  /**
   * Fan a notification out to every active user whose role grants `permissionKey`
   * (used for finance alerts). Idempotent per entity: if a recipient already has
   * an *unread* notification of the same type + related entity, it is skipped so a
   * daily sweep doesn't spam duplicates. Returns how many were created.
   */
  async notifyUsersWithPermission(
    permissionKey: string,
    params: Omit<CreateNotificationParams, 'userId'>,
  ): Promise<{ notified: number }> {
    const users = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        role: { permissions: { some: { permission: { key: permissionKey } } } },
      },
      select: { id: true },
    });

    let notified = 0;
    for (const user of users) {
      if (params.relatedEntityId) {
        const duplicate = await this.prisma.notification.findFirst({
          where: {
            userId: user.id,
            type: params.type,
            relatedEntityId: params.relatedEntityId,
            isRead: false,
          },
          select: { id: true },
        });
        if (duplicate) continue;
      }
      await this.create({ ...params, userId: user.id });
      notified += 1;
    }
    return { notified };
  }

  async findAllForUser(userId: string, query: NotificationsQueryDto) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.isRead !== undefined ? { isRead: query.isRead } : {}),
    };

    return paginate(this.prisma.notification, query, {
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, isRead: false } });
    return { count };
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException('Cannot modify another user\'s notification');
    }
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }
}
