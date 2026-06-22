// Audit coverage: mutating service methods should record an audit-log entry
// (directly via AuditLogService.record / this.audit, or via an @AuditEntity
// interceptor on the sibling controller). Heuristic — review before acting.
import { BACKEND, read, rel, section, walk } from './lib.mjs';

const MUTATING = /^(create|update|remove|delete|approve|reject|submit|post|issue|convert|reimburse|changeStatus|applyFinanceStatus|attachReceipt|resetPassword|revoke\w*)$/i;

// Verified-correct exemptions (`<file>::<method>`), reviewed in FINDINGS F-005:
//  - auth revokeAllForUser DOES audit (records LOGOUT); the heuristic's body
//    slicing just misses it.
//  - notifications.create is a system side-effect, intentionally not audited.
//  - storage.delete is a low-level file util; the calling service audits the entity.
const EXEMPT = new Set([
  'auth.service.ts::revokeAllForUser',
  'notifications.service.ts::create',
  'storage.service.ts::delete',
]);

export function auditCoverage() {
  // Controllers that audit via the interceptor cover their whole module.
  const interceptorModules = new Set();
  for (const f of walk(`${BACKEND}/src`, /\.controller\.ts$/)) {
    if (/@AuditEntity\(/.test(read(f))) {
      interceptorModules.add(f.replace(/[^/]+\.controller\.ts$/, ''));
    }
  }

  const items = [];
  for (const f of walk(`${BACKEND}/src`, /\.service\.ts$/)) {
    if (/\.spec\.ts$/.test(f)) continue;
    const dir = f.replace(/[^/]+\.service\.ts$/, '');
    if (interceptorModules.has(dir)) continue; // covered by @AuditEntity
    const txt = read(f);
    // Class methods sit at exactly 2-space indent; control-flow (if/for/…) is
    // deeper, so anchoring to 2 spaces avoids matching statements as methods.
    const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'await', 'constructor', 'function', 'get', 'set']);
    const re = /\n {2}(?:async\s+)?(\w+)\s*\(/g;
    const starts = [];
    let m;
    while ((m = re.exec(txt)) !== null) {
      if (!KEYWORDS.has(m[1])) starts.push({ name: m[1], idx: m.index });
    }
    const base = f.split('/').pop();
    for (let i = 0; i < starts.length; i++) {
      const { name, idx } = starts[i];
      if (!MUTATING.test(name)) continue;
      if (EXEMPT.has(`${base}::${name}`)) continue;
      const end = i + 1 < starts.length ? starts[i + 1].idx : txt.length;
      const body = txt.slice(idx, end);
      if (!/audit|record\(/i.test(body)) {
        items.push({
          severity: 'MEDIUM',
          msg: `\`${name}()\` in ${rel(f)} appears to mutate state but has no audit-log call and no @AuditEntity on its controller.`,
        });
      }
    }
  }
  const summary = 'Heuristic: mutating service methods lacking an audit-log entry (and not covered by an @AuditEntity interceptor).';
  return section('Audit-log coverage of mutations', summary, items);
}
