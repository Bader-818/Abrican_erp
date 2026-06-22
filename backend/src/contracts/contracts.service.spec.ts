import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ContractsService } from './contracts.service';

describe('ContractsService', () => {
  let prisma: any;
  let service: ContractsService;

  beforeEach(() => {
    prisma = {
      client: { findUnique: jest.fn().mockResolvedValue({ id: 'c1' }) },
      contract: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'k1', contractValue: 0, ...data })),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    service = new ContractsService(prisma as any);
  });

  const dto = {
    clientId: 'c1',
    contractNumber: 'CT-001',
    title: 'MSA',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    paymentTermsDays: 30,
  };

  it('rejects an invalid clientId', async () => {
    prisma.client.findUnique.mockResolvedValue(null);
    await expect(service.create(dto as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects endDate on/before startDate', async () => {
    await expect(service.create({ ...dto, endDate: '2026-01-01' } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a duplicate contract number', async () => {
    prisma.contract.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.create(dto as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it('findOne throws NotFound for a missing contract', async () => {
    prisma.contract.findUnique.mockResolvedValue(null);
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks deleting a contract with POs/jobs', async () => {
    prisma.contract.findUnique.mockResolvedValue({ _count: { purchaseOrders: 1, jobs: 0 } });
    await expect(service.remove('k1')).rejects.toBeInstanceOf(ConflictException);
  });
});
