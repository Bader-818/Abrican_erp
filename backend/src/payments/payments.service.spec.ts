import { BadRequestException, ConflictException } from '@nestjs/common';
import { InvoiceStatus, JobStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';

function makeUser(permissions: string[] = []): AuthenticatedUser {
  return { id: 'user-1', email: 'a@b.c', name: 'T', roleId: 'r', roleName: 'Admin', permissions, mfaEnabled: false, mustChangePassword: false };
}

describe('PaymentsService', () => {
  let prisma: any;
  let audit: { record: jest.Mock };
  let jobStatus: { applyFinanceStatus: jest.Mock };
  let service: PaymentsService;

  const baseInvoice = {
    id: 'inv-1',
    invoiceNumber: 'INV-2026-0001',
    clientId: 'client-1',
    jobId: 'job-1',
    status: InvoiceStatus.SUBMITTED,
    totalAmount: 1000,
    paidAmount: 0,
  };

  beforeEach(() => {
    const tx = {
      payment: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'pay-1', ...data })) },
      invoice: { update: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      invoice: { findUnique: jest.fn().mockResolvedValue({ ...baseInvoice }), findMany: jest.fn() },
      payment: { findMany: jest.fn(), count: jest.fn() },
      $transaction: jest.fn((cb: any) => cb(tx)),
      _tx: tx,
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    jobStatus = { applyFinanceStatus: jest.fn().mockResolvedValue(undefined) };
    service = new PaymentsService(prisma, audit as any, jobStatus as any);
  });

  it('records a partial payment, sets invoice PARTIALLY_PAID and advances the job', async () => {
    await service.create({ invoiceId: 'inv-1', amount: 400 }, makeUser());

    expect(prisma._tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paidAmount: 400,
          outstandingAmount: 600,
          status: InvoiceStatus.PARTIALLY_PAID,
        }),
      }),
    );
    expect(jobStatus.applyFinanceStatus).toHaveBeenCalledWith(
      'job-1',
      JobStatus.PARTIALLY_PAID,
      'user-1',
      expect.any(String),
      expect.anything(),
    );
  });

  it('marks the invoice PAID and the job PAID when fully settled', async () => {
    prisma.invoice.findUnique.mockResolvedValue({ ...baseInvoice, paidAmount: 600 });
    await service.create({ invoiceId: 'inv-1', amount: 400 }, makeUser());

    expect(prisma._tx.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outstandingAmount: 0, status: InvoiceStatus.PAID }),
      }),
    );
    expect(jobStatus.applyFinanceStatus).toHaveBeenCalledWith(
      'job-1',
      JobStatus.PAID,
      'user-1',
      expect.any(String),
      expect.anything(),
    );
  });

  it('rejects an overpayment beyond the outstanding balance', async () => {
    prisma.invoice.findUnique.mockResolvedValue({ ...baseInvoice, paidAmount: 600 });
    await expect(
      service.create({ invoiceId: 'inv-1', amount: 500 }, makeUser()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses to pay an invoice that has not been issued', async () => {
    prisma.invoice.findUnique.mockResolvedValue({ ...baseInvoice, status: InvoiceStatus.DRAFT });
    await expect(
      service.create({ invoiceId: 'inv-1', amount: 100 }, makeUser()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  describe('aging', () => {
    it('buckets outstanding invoices by days past due', async () => {
      const day = 86_400_000;
      const now = Date.now();
      prisma.invoice.findMany.mockResolvedValue([
        { id: 'a', invoiceNumber: 'A', dueDate: new Date(now - 10 * day), outstandingAmount: 100, status: 'SUBMITTED', client: { id: 'c', name: 'C' } },
        { id: 'b', invoiceNumber: 'B', dueDate: new Date(now - 45 * day), outstandingAmount: 200, status: 'PARTIALLY_PAID', client: { id: 'c', name: 'C' } },
        { id: 'c', invoiceNumber: 'C', dueDate: new Date(now - 120 * day), outstandingAmount: 300, status: 'SUBMITTED', client: { id: 'c', name: 'C' } },
      ]);

      const report = await service.aging();
      expect(report.buckets.current).toBe(100);
      expect(report.buckets.d31_60).toBe(200);
      expect(report.buckets.d90_plus).toBe(300);
      expect(report.totalOutstanding).toBe(600);
    });
  });
});
