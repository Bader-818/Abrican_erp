const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/**
 * Parses simple duration strings used for JWT expirations (e.g. "15m", "7d", "30s")
 * into milliseconds. Falls back to treating a bare number as milliseconds.
 */
export function parseDurationToMs(duration: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(duration.trim());
  if (!match) {
    const asNumber = Number(duration);
    if (!Number.isNaN(asNumber)) {
      return asNumber;
    }
    throw new Error(`Invalid duration string: ${duration}`);
  }
  const [, value, unit] = match;
  return Number(value) * UNIT_MS[unit];
}
