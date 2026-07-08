import { BadRequestException, ConflictException } from '@nestjs/common';
import { EstimateStatus, InvoiceStatus, JobStatus } from '@prisma/client';
import { InvoicesService } from './invoices.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.interface';

function makeUser(permissions: string[] = ['invoices.approve']): AuthenticatedUser {
  return { id: 'user-1', email: 'a@b.c', name: 'T', roleId: 'r', roleName: 'Admin', permissions, mfaEnabled: false, mustChangePassword: false };
}

describe('InvoicesService', () => {
  let prisma: any;
  let audit: { record: jest.Mock };
  let jobStatus: { applyFinanceStatus: jest.Mock };
  let pdf: any;
  let storage: any;
  let service: InvoicesService;

  beforeEach(() => {
    const tx = {
      invoice: {
        update: jest.fn().mockResolvedValue({ id: 'inv-1', status: InvoiceStatus.SUBMITTED }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'inv-1', status: InvoiceStatus.SUBMITTED }),
      },
      purchaseOrder: { update: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      client: { findUnique: jest.fn().mockResolvedValue({ id: 'client-1', vatNumber: '3001', billingAddress: 'Dammam', paymentTermsDays: 30 }) },
      contract: { findUnique: jest.fn() },
      purchaseOrder: { findUnique: jest.fn() },
      job: { findUnique: jest.fn() },
      estimate: { findUnique: jest.fn() },
      invoice: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'inv-1', ...data })),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((cb: any) => cb(tx)),
      _tx: tx,
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    jobStatus = { applyFinanceStatus: jest.fn().mockResolvedValue(undefined) };
    pdf = { renderFinancialDocument: jest.fn().mockResolvedValue(Buffer.from('x')) };
    storage = { save: jest.fn().mockResolvedValue({ url: '/files/invoices/x.pdf' }) };
    const financeAlerts = { afterInvoiceIssued: jest.fn().mockResolvedValue(undefined) };
    service = new InvoicesService(
      prisma as any,
      audit as any,
      jobStatus as any,
      pdf as any,
      storage as any,
      financeAlerts as any,
    );
  });

  describe('createFromEstimate', () => {
    const approvedEstimate = {
      id: 'est-1',
      status: EstimateStatus.APPROVED,
      clientId: 'client-1',
      contractId: null,
      jobId: 'job-1',
      lineItems: [
        { id: 'el-1', contractRateCardId: null, lineKind: 'LABOR', description: 'Operator', quantity: 2, hours: 100, unit: 'HOUR', unitPrice: 110, vatRate: 15 },
      ],
    };

    it('copies estimate lines and computes invoice totals', async () => {
      prisma.estimate.findUnique.mockResolvedValue(approvedEstimate);
      await service.createFromEstimate({ estimateId: 'est-1' }, makeUser());

      const data = prisma.invoice.create.mock.calls[0][0].data;
      expect(data.subtotal).toBe(22000);
      expect(data.vatAmount).toBe(3300);
      expect(data.totalAmount).toBe(25300);
      expect(data.outstandingAmount).toBe(25300);
      expect(data.estimateId).toBe('est-1');
      expect(data.jobId).toBe('job-1');
      expect(data.lineItems.create[0].sourceEstimateLineItemId).toBe('el-1');
    });

    it('refuses estimates that are not APPROVED or CONVERTED', async () => {
      prisma.estimate.findUnique.mockResolvedValue({ ...approvedEstimate, status: EstimateStatus.DRAFT });
      await expect(
        service.createFromEstimate({ estimateId: 'est-1' }, makeUser()),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('issue', () => {
    const approvedInvoice = {
      id: 'inv-1',
      invoiceNumber: 'INV-2026-0001',
      status: InvoiceStatus.APPROVED,
      clientVatNumber: '3001',
      totalAmount: 25300,
      jobId: 'job-1',
      purchaseOrderId: null,
      purchaseOrder: null,
      _count: { lineItems: 1 },
    };

    it('issues an approved invoice and advances the job to INVOICED', async () => {
      prisma.invoice.findUnique.mockResolvedValue(approvedInvoice);
      await service.issue('inv-1', {}, makeUser());

      expect(prisma._tx.invoice.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: InvoiceStatus.APPROVED }),
          data: expect.objectContaining({ status: InvoiceStatus.SUBMITTED }),
        }),
      );
      expect(jobStatus.applyFinanceStatus).toHaveBeenCalledWith(
        'job-1',
        JobStatus.INVOICED,
        'user-1',
        expect.any(String),
        expect.anything(),
      );
    });

    it('blocks issuing without a client VAT number', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ ...approvedInvoice, clientVatNumber: null });
      await expect(service.issue('inv-1', {}, makeUser())).rejects.toBeInstanceOf(BadRequestException);
    });

    it('blocks issuing beyond the PO balance unless overridden', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        ...approvedInvoice,
        purchaseOrderId: 'po-1',
        purchaseOrder: { id: 'po-1', poValue: 20000, consumedAmount: 0 },
      });
      await expect(service.issue('inv-1', {}, makeUser())).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses to issue an invoice that is not APPROVED', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ ...approvedInvoice, status: InvoiceStatus.DRAFT });
      await expect(service.issue('inv-1', {}, makeUser())).rejects.toBeInstanceOf(ConflictException);
    });

    it('conflicts on a concurrent double-issue instead of consuming the PO twice (CAS guard)', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        ...approvedInvoice,
        purchaseOrderId: 'po-1',
        purchaseOrder: { id: 'po-1', poValue: 100000, consumedAmount: 0 },
      });
      prisma._tx.invoice.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.issue('inv-1', {}, makeUser())).rejects.toBeInstanceOf(ConflictException);
      expect(prisma._tx.purchaseOrder.update).not.toHaveBeenCalled();
      expect(jobStatus.applyFinanceStatus).not.toHaveBeenCalled();
    });
  });
});
