// Decimal serialization: Prisma Decimal columns serialize to JSON strings, so
// the matching frontend type fields must be `string` (not `number`). Heuristic:
// money/rate-ish field names typed as `number` in the frontend types are flagged.
import { FRONTEND, read, section } from './lib.mjs';

const MONEY_HINT = /(amount|subtotal|vat|cost|price|rate|balance|paid|outstanding|owed|profit|margin|budget)/i;
// Pagination/count fields that are legitimately numbers, not Decimals.
const COUNT_FIELDS = new Set(['total', 'totalPages', 'page', 'pageSize', 'count', 'unreadCount']);

export function decimalParity() {
  const text = read(`${FRONTEND}/src/types/index.ts`);
  const items = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    // Explicit opt-out for intentional computed-aggregate numbers (round2 → number).
    if (/audit:decimal-ok/.test(line)) return;
    const bare = line.replace(/\/\/.*$/, '').trimEnd(); // tolerate trailing comments
    // field: number   or   field: number | null
    const m = bare.match(/^\s*(\w+)\??\s*:\s*number(\s*\|\s*null)?\s*$/);
    if (!m) return;
    const field = m[1];
    if (COUNT_FIELDS.has(field)) return;
    if (MONEY_HINT.test(field)) {
      // Computed aggregates (aging/summary endpoints) return numbers via round2;
      // raw entity Decimals must be string. Flag all for one-time review.
      const sev = 'HIGH';
      items.push({
        severity: sev,
        msg: `Field \`${field}: number\` may receive a Prisma Decimal (serialized as string) — confirm it should be \`string\`.`,
        evidence: `types/index.ts:${i + 1}  ${line.trim()}`,
      });
    }
  });
  const summary = 'Heuristic scan of frontend amount/rate fields typed as `number` that may carry Prisma Decimals (strings over the wire).';
  return section('Decimal serialization parity (frontend money fields)', summary, items);
}
