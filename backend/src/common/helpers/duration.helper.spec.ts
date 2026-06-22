import { parseDurationToMs } from './duration.helper';

describe('parseDurationToMs', () => {
  it('parses unit suffixes', () => {
    expect(parseDurationToMs('500ms')).toBe(500);
    expect(parseDurationToMs('30s')).toBe(30_000);
    expect(parseDurationToMs('15m')).toBe(900_000);
    expect(parseDurationToMs('2h')).toBe(7_200_000);
    expect(parseDurationToMs('7d')).toBe(604_800_000);
  });

  it('tolerates surrounding whitespace and inner space', () => {
    expect(parseDurationToMs('  15m ')).toBe(900_000);
    expect(parseDurationToMs('15 m')).toBe(900_000);
  });

  it('treats a bare number as milliseconds', () => {
    expect(parseDurationToMs('1000')).toBe(1000);
  });

  it('throws on invalid input', () => {
    expect(() => parseDurationToMs('abc')).toThrow('Invalid duration string');
    expect(() => parseDurationToMs('10x')).toThrow('Invalid duration string');
  });
});
