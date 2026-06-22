import { isStrongPassword } from './is-strong-password.validator';

describe('isStrongPassword', () => {
  it('accepts a long password with 3+ character classes', () => {
    expect(isStrongPassword('Abrican2026!ok')).toBe(true);
    expect(isStrongPassword('Sup3rSecret-Pass')).toBe(true);
  });

  it('rejects passwords shorter than 12 characters', () => {
    expect(isStrongPassword('Short1!a')).toBe(false);
    expect(isStrongPassword('Admin@12345')).toBe(false); // 11 chars
  });

  it('rejects long passwords with too few character classes', () => {
    expect(isStrongPassword('aaaaaaaaaaaa')).toBe(false); // one class
    expect(isStrongPassword('alllowercaseonly')).toBe(false); // one class
  });

  it('rejects common passwords even if long', () => {
    expect(isStrongPassword('password123')).toBe(false);
    expect(isStrongPassword('letmein12345')).toBe(false);
  });

  it('rejects non-strings and over-long input', () => {
    expect(isStrongPassword(undefined)).toBe(false);
    expect(isStrongPassword(12345678)).toBe(false);
    expect(isStrongPassword('A1!' + 'x'.repeat(200))).toBe(false);
  });
});
