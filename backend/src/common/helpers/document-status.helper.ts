export type DocumentExpiryStatus =
  | 'VALID'
  | 'EXPIRING_30'
  | 'EXPIRING_60'
  | 'EXPIRING_90'
  | 'EXPIRED'
  | 'NO_EXPIRY';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Computes the expiry status of a document on read (never persisted).
 *
 * - No expiryDate              -> NO_EXPIRY
 * - expiryDate in the past     -> EXPIRED
 * - expiryDate within 30 days  -> EXPIRING_30
 * - expiryDate within 60 days  -> EXPIRING_60
 * - expiryDate within 90 days  -> EXPIRING_90
 * - otherwise                  -> VALID
 */
export function computeDocumentStatus(
  expiryDate: Date | string | null | undefined,
  now: Date = new Date(),
): DocumentExpiryStatus {
  if (!expiryDate) {
    return 'NO_EXPIRY';
  }

  const expiry = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfExpiry = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());

  const diffDays = Math.round((startOfExpiry.getTime() - startOfNow.getTime()) / DAY_MS);

  if (diffDays < 0) {
    return 'EXPIRED';
  }
  if (diffDays <= 30) {
    return 'EXPIRING_30';
  }
  if (diffDays <= 60) {
    return 'EXPIRING_60';
  }
  if (diffDays <= 90) {
    return 'EXPIRING_90';
  }
  return 'VALID';
}
