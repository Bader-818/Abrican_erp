/**
 * Shared money math for estimate & invoice line items.
 *
 * A line is `quantity × hours × unitPrice` (hours defaults to 1 for LUMP_SUM /
 * per-unit lines), with VAT applied at `vatRate` percent. All figures are
 * rounded to 2 decimal places. Computed in JS numbers, then persisted as Prisma
 * Decimals — inputs are small enough that float error never reaches halalas.
 */

export interface LineInput {
  quantity: number;
  hours?: number;
  unitPrice: number;
  vatRate?: number;
}

export interface LineAmounts {
  lineSubtotal: number;
  lineVat: number;
  lineTotal: number;
}

export interface DocumentTotals {
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
}

export const DEFAULT_VAT_RATE = 15;

/** Round to 2 decimals, avoiding the classic 1.005 → 1.00 float trap. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeLine(line: LineInput): LineAmounts {
  const hours = line.hours ?? 1;
  const vatRate = line.vatRate ?? DEFAULT_VAT_RATE;
  const lineSubtotal = round2(line.quantity * hours * line.unitPrice);
  const lineVat = round2((lineSubtotal * vatRate) / 100);
  const lineTotal = round2(lineSubtotal + lineVat);
  return { lineSubtotal, lineVat, lineTotal };
}

export function sumTotals(lines: LineAmounts[]): DocumentTotals {
  const subtotal = round2(lines.reduce((acc, l) => acc + l.lineSubtotal, 0));
  const vatAmount = round2(lines.reduce((acc, l) => acc + l.lineVat, 0));
  const totalAmount = round2(subtotal + vatAmount);
  return { subtotal, vatAmount, totalAmount };
}
