import { computeDocumentStatus } from './document-status.helper';

describe('computeDocumentStatus', () => {
  const now = new Date('2026-06-14T12:00:00Z');

  const inDays = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d;
  };

  it('returns NO_EXPIRY when there is no expiry date', () => {
    expect(computeDocumentStatus(null, now)).toBe('NO_EXPIRY');
    expect(computeDocumentStatus(undefined, now)).toBe('NO_EXPIRY');
  });

  it('returns EXPIRED for a past date', () => {
    expect(computeDocumentStatus(inDays(-1), now)).toBe('EXPIRED');
    expect(computeDocumentStatus(inDays(-365), now)).toBe('EXPIRED');
  });

  it('returns EXPIRING_30 within 30 days (inclusive)', () => {
    expect(computeDocumentStatus(inDays(0), now)).toBe('EXPIRING_30');
    expect(computeDocumentStatus(inDays(30), now)).toBe('EXPIRING_30');
  });

  it('returns EXPIRING_60 for 31-60 days', () => {
    expect(computeDocumentStatus(inDays(31), now)).toBe('EXPIRING_60');
    expect(computeDocumentStatus(inDays(60), now)).toBe('EXPIRING_60');
  });

  it('returns EXPIRING_90 for 61-90 days', () => {
    expect(computeDocumentStatus(inDays(61), now)).toBe('EXPIRING_90');
    expect(computeDocumentStatus(inDays(90), now)).toBe('EXPIRING_90');
  });

  it('returns VALID beyond 90 days', () => {
    expect(computeDocumentStatus(inDays(91), now)).toBe('VALID');
    expect(computeDocumentStatus(inDays(400), now)).toBe('VALID');
  });

  it('accepts ISO string input', () => {
    expect(computeDocumentStatus(inDays(10).toISOString(), now)).toBe('EXPIRING_30');
  });
});
