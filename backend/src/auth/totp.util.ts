import { authenticator } from 'otplib';

const ISSUER = 'Abrican ERP';

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/** otpauth:// URI for an authenticator app to scan as a QR code. */
export function totpKeyUri(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export function verifyTotp(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token: token.trim(), secret });
  } catch {
    return false;
  }
}
