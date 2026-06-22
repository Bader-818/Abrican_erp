import { computeLine, round2, sumTotals } from './line-math';

describe('finance line-math', () => {
  describe('round2', () => {
    it('rounds to 2 decimals', () => {
      expect(round2(1.005)).toBe(1.01);
      expect(round2(2.349)).toBe(2.35);
      expect(round2(100)).toBe(100);
    });
  });

  describe('computeLine', () => {
    it('computes quantity × hours × unitPrice with 15% VAT', () => {
      // 2 operators × 100 hours × 110 SAR/hr = 22,000
      const line = computeLine({ quantity: 2, hours: 100, unitPrice: 110 });
      expect(line.lineSubtotal).toBe(22000);
      expect(line.lineVat).toBe(3300);
      expect(line.lineTotal).toBe(25300);
    });

    it('defaults hours to 1 for per-unit / lump-sum lines', () => {
      const line = computeLine({ quantity: 1, unitPrice: 5000, vatRate: 15 });
      expect(line.lineSubtotal).toBe(5000);
      expect(line.lineTotal).toBe(5750);
    });

    it('honours a custom VAT rate (including 0)', () => {
      const zero = computeLine({ quantity: 1, hours: 1, unitPrice: 1000, vatRate: 0 });
      expect(zero.lineVat).toBe(0);
      expect(zero.lineTotal).toBe(1000);
    });
  });

  describe('sumTotals', () => {
    it('rolls up the document subtotal, VAT, and total', () => {
      const lines = [
        computeLine({ quantity: 2, hours: 100, unitPrice: 110 }), // 22,000 + 3,300
        computeLine({ quantity: 1, hours: 100, unitPrice: 742 }), // 74,200 + 11,130
      ];
      const totals = sumTotals(lines);
      expect(totals.subtotal).toBe(96200);
      expect(totals.vatAmount).toBe(14430);
      expect(totals.totalAmount).toBe(110630);
    });

    it('returns zeros for an empty line set', () => {
      expect(sumTotals([])).toEqual({ subtotal: 0, vatAmount: 0, totalAmount: 0 });
    });
  });
});
