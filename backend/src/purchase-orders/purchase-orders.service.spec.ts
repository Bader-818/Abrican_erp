import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';

// Covers INV-D2 (PO integrity) with mocked Prisma.
describe('PurchaseOrdersService', () => {
  let prisma: any;
  let service: PurchaseOrdersService;

  beforeEach(() => {
    prisma = {
      client: { findUnique: jest.fn().mockResolvedValue({ id: 'c1' }) },
      contract: { findUnique: jest.fn().mockResolvedValue({ clientId: 'c1' }) },
      purchaseOrder: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'po-1', consumedAmount: 0, ...data })),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    service = new PurchaseOrdersService(prisma as any);
  });

  const dto = {
    clientId: 'c1',
    poNumber: 'PO-001',
    poValue: 100000,
    issueDate: '2026-01-01',
    expiryDate: '2026-12-31',
  };

  it('rejects an invalid clientId', async () => {
    prisma.client.findUnique.mockResolvedValue(null);
    await expect(service.create(dto as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects expiryDate on/before issueDate', async () => {
    await expect(service.create({ ...dto, expiryDate: '2026-01-01' } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a duplicate PO number', async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.create(dto as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it('findOne throws NotFound for a missing PO', async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue(null);
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks deleting a PO that has jobs', async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue({ _count: { jobs: 2 } });
    await expect(service.remove('po-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.purchaseOrder.delete).not.toHaveBeenCalled();
  });

  it('allows deleting a PO with no jobs', async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue({ _count: { jobs: 0 } });
    await expect(service.remove('po-1')).resolves.toEqual({ success: true });
  });
});
