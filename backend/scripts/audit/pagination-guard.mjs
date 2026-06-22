// Pagination guard: PaginationQueryDto caps pageSize at 100. Any pageSize > 100
// (frontend dropdown loaders or backend calls) returns 400 → empty list/dropdown.
import { BACKEND, FRONTEND, read, rel, section, walk } from './lib.mjs';

export function paginationGuard() {
  const files = [...walk(`${BACKEND}/src`, /\.ts$/), ...walk(`${FRONTEND}/src`, /\.(ts|tsx)$/)];
  const items = [];
  for (const f of files) {
    if (/\.spec\.ts$|\.test\.ts$/.test(f)) continue;
    const lines = read(f).split('\n');
    lines.forEach((line, i) => {
      const m = line.match(/pageSize\s*[:=]\s*(\d+)/);
      if (m && Number(m[1]) > 100) {
        items.push({
          severity: 'HIGH',
          msg: `pageSize ${m[1]} exceeds the API maximum of 100 → request 400s and the list/dropdown comes back empty.`,
          evidence: `${rel(f)}:${i + 1}  ${line.trim()}`,
        });
      }
    });
  }
  const summary = 'Scans for any `pageSize` literal greater than 100 (the PaginationQueryDto cap).';
  return section('Pagination cap (pageSize ≤ 100)', summary, items);
}
