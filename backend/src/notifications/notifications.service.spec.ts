import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

// Covers per-user notification ownership.
describe('NotificationsService', () => {
  let prisma: any;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = {
      notification: {
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'n1', ...data })),
        count: jest.fn().mockResolvedValue(4),
      },
    };
    service = new NotificationsService(prisma as any);
  });

  it('throws NotFound when marking a missing notification', async () => {
    prisma.notification.findUnique.mockResolvedValue(null);
    await expect(service.markAsRead('u1', 'n1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it("forbids marking another user's notification", async () => {
    prisma.notification.findUnique.mockResolvedValue({ id: 'n1', userId: 'someone-else' });
    await expect(service.markAsRead('u1', 'n1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('marks your own notification read', async () => {
    prisma.notification.findUnique.mockResolvedValue({ id: 'n1', userId: 'u1' });
    const result = await service.markAsRead('u1', 'n1');
    expect(result.isRead).toBe(true);
  });

  it('reports the unread count', async () => {
    await expect(service.unreadCount('u1')).resolves.toEqual({ count: 4 });
  });
});
