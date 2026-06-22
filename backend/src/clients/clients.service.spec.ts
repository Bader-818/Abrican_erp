import { ConflictException, NotFoundException } from '@nestjs/common';
import { ClientsService } from './clients.service';

describe('ClientsService', () => {
  let prisma: any;
  let service: ClientsService;

  beforeEach(() => {
    prisma = {
      client: { findUnique: jest.fn(), delete: jest.fn().mockResolvedValue({}) },
    };
    service = new ClientsService(prisma as any);
  });

  it('findOne throws NotFound for a missing client', async () => {
    prisma.client.findUnique.mockResolvedValue(null);
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks deleting a client with contracts/POs/jobs (INV-D2-4)', async () => {
    prisma.client.findUnique.mockResolvedValue({ _count: { contracts: 1, purchaseOrders: 0, jobs: 0 } });
    await expect(service.remove('c1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.client.delete).not.toHaveBeenCalled();
  });

  it('allows deleting an unreferenced client', async () => {
    prisma.client.findUnique.mockResolvedValue({ _count: { contracts: 0, purchaseOrders: 0, jobs: 0 } });
    await expect(service.remove('c1')).resolves.toEqual({ success: true });
  });
});
