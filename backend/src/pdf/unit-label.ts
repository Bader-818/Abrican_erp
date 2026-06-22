import { BillingUnit, LineKind } from '@prisma/client';

/**
 * Short unit code shown on the PDF (MH = man-hour, EH = equipment-hour,
 * VAL = value/lump-sum), matching the company's invoice conventions.
 */
export function mapUnitLabel(lineKind: LineKind, unit: BillingUnit): string {
  if (unit === BillingUnit.LUMP_SUM) return 'VAL';
  if (unit === BillingUnit.HOUR) return lineKind === LineKind.EQUIPMENT ? 'EH' : 'MH';
  switch (unit) {
    case BillingUnit.DAY:
      return 'DAY';
    case BillingUnit.TRIP:
      return 'TRIP';
    case BillingUnit.METER:
      return 'M';
    case BillingUnit.UNIT:
      return 'EA';
    default:
      return unit;
  }
}
