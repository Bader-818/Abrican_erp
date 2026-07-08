import { NotificationType } from '@prisma/client';
import { FinanceAlertsService } from './finance-alerts.service';

describe('FinanceAlertsService', () => {
  let prisma: any;
  let notifications: { notifyUsersWithPermission: jest.Mock };
  let service: FinanceAlertsService;

  beforeEach(() => {
    prisma = {
      invoice: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      job: { findMany: jest.fn().mockResolvedValue([]) },
    };
    notifications = { notifyUsersWithPermission: jest.fn().mockResolvedValue({ notified: 1 }) };
    service = new FinanceAlertsService(prisma as any, notifications as any);
  });

  describe('afterInvoiceIssued', () => {
    it('raises INVOICE_EXCEEDS_PO when the PO is over-consumed', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        invoiceNumber: 'INV-1',
        purchaseOrder: { id: 'po1', poNumber: 'PO-1', poValue: 1000, consumedAmount: 1200 },
      });
      await service.afterInvoiceIssued('inv1');
      expect(notifications.notifyUsersWithPermission).toHaveBeenCalledWith(
        'invoices.view',
        expect.objectContaining({ type: NotificationType.INVOICE_EXCEEDS_PO, relatedEntityId: 'po1' }),
      );
    });

    it('raises PO_NEARLY_CONSUMED at ≥ 90% but not below', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        invoiceNumber: 'INV-1',
        purchaseOrder: { id: 'po1', poNumber: 'PO-1', poValue: 1000, consumedAmount: 950 },
      });
      await service.afterInvoiceIssued('inv1');
      expect(notifications.notifyUsersWithPermission).toHaveBeenCalledWith(
        'invoices.view',
        expect.objectContaining({ type: NotificationType.PO_NEARLY_CONSUMED }),
      );
    });

    it('is silent when the PO is comfortably within budget', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        invoiceNumber: 'INV-1',
        purchaseOrder: { id: 'po1', poNumber: 'PO-1', poValue: 1000, consumedAmount: 500 },
      });
      await service.afterInvoiceIssued('inv1');
      expect(notifications.notifyUsersWithPermission).not.toHaveBeenCalled();
    });

    it('does nothing when the invoice has no PO', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ invoiceNumber: 'INV-1', purchaseOrder: null });
      await service.afterInvoiceIssued('inv1');
      expect(notifications.notifyUsersWithPermission).not.toHaveBeenCalled();
    });
  });

  describe('afterCostReview', () => {
    it('raises COST_OVER_BUDGET and MARGIN_BELOW_TARGET together', async () => {
      await service.afterCostReview('j1', {
        jobCode: 'JOB-1',
        actualCost: 1200,
        costBudget: 1000,
        grossMarginPct: 5,
      });
      const types = notifications.notifyUsersWithPermission.mock.calls.map((c) => c[1].type);
      expect(types).toContain(NotificationType.COST_OVER_BUDGET);
      expect(types).toContain(NotificationType.MARGIN_BELOW_TARGET);
    });

    it('stays quiet within budget and above target margin', async () => {
      await service.afterCostReview('j1', {
        jobCode: 'JOB-1',
        actualCost: 800,
        costBudget: 1000,
        grossMarginPct: 25,
      });
      expect(notifications.notifyUsersWithPermission).not.toHaveBeenCalled();
    });
  });

  describe('checkOverdueInvoices', () => {
    it('notifies payments viewers for each past-due invoice', async () => {
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv1',
          invoiceNumber: 'INV-9',
          dueDate: new Date(Date.now() - 10 * 86_400_000),
          outstandingAmount: 500,
          client: { name: 'Acme' },
        },
      ]);
      await service.checkOverdueInvoices();
      expect(notifications.notifyUsersWithPermission).toHaveBeenCalledWith(
        'payments.view',
        expect.objectContaining({ type: NotificationType.INVOICE_OVERDUE, relatedEntityId: 'inv1' }),
      );
    });
  });
});
