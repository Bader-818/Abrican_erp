// RBAC triangle: reconcile permissions across backend decorators + imperative
// checks, the seed (definitions + role grants), and the frontend (gating + nav).
import { BACKEND, FRONTEND, matchAll, read, rel, section, sortUniq, walk, diff } from './lib.mjs';

export function rbacTriangle() {
  // (a) backend decorator perms + (b) imperative perms
  const controllers = walk(`${BACKEND}/src`, /\.controller\.ts$/);
  const services = walk(`${BACKEND}/src`, /\.(service|guard)\.ts$/);
  let decoratorPerms = [];
  for (const f of controllers) {
    const txt = read(f);
    for (const call of matchAll(txt, /@RequirePermissions\(([^)]*)\)/)) {
      decoratorPerms.push(...matchAll(call, /'([^']+)'/));
    }
  }
  let imperativePerms = [];
  for (const f of [...controllers, ...services]) {
    imperativePerms.push(...matchAll(read(f), /permissions\.includes\('([^']+)'\)/));
  }
  const usedBackend = sortUniq([...decoratorPerms, ...imperativePerms]);

  // (c) seeded definitions + (d) role grants
  const seed = read(`${BACKEND}/prisma/seed.ts`);
  const seeded = sortUniq(matchAll(seed, /key:\s*'([^']+)'/));
  const rpStart = seed.indexOf('ROLE_PERMISSIONS');
  const grantBlock = rpStart >= 0 ? seed.slice(rpStart) : '';
  // grants are bare 'perm.key' strings inside ROLE_PERMISSIONS arrays
  let grantedLiterals = matchAll(grantBlock, /'([a-z_]+\.[a-z_.]+)'/);
  // Admin is granted ALL_PERMISSION_KEYS (a spread, not literals) — resolve it.
  if (/ALL_PERMISSION_KEYS/.test(grantBlock)) grantedLiterals = grantedLiterals.concat(seeded);
  const granted = sortUniq(grantedLiterals);

  // (e) frontend usage
  const feFiles = walk(`${FRONTEND}/src`, /\.(ts|tsx)$/);
  let frontend = [];
  for (const f of feFiles) {
    const txt = read(f);
    frontend.push(...matchAll(txt, /hasPermission\(\s*'([^']+)'/));
    frontend.push(...matchAll(txt, /permission:\s*'([^']+)'/));
    frontend.push(...matchAll(txt, /permission="([^"]+)"/));
  }
  frontend = sortUniq(frontend);

  const items = [];
  // CRITICAL: used by an endpoint but never seeded → no role can ever hold it → 403 for all.
  for (const p of diff(usedBackend, seeded)) {
    items.push({ severity: 'CRITICAL', msg: `Permission \`${p}\` is enforced by the backend but is not in the seed PERMISSIONS list — no role can be granted it (403 for everyone).` });
  }
  // HIGH: granted in a role but not defined → typo / dead grant.
  for (const p of diff(granted, seeded)) {
    items.push({ severity: 'HIGH', msg: `Permission \`${p}\` is granted to a role but not defined in PERMISSIONS (likely a typo).` });
  }
  // MEDIUM: defined + (often granted) but no endpoint/imperative check uses it → orphan.
  for (const p of diff(seeded, usedBackend)) {
    const grantedNote = granted.includes(p) ? ' (and granted to roles)' : '';
    items.push({ severity: 'MEDIUM', msg: `Permission \`${p}\` is defined${grantedNote} but no backend endpoint or imperative check references it — orphan permission.` });
  }
  // LOW: defined but never granted to any role.
  for (const p of diff(seeded, granted)) {
    items.push({ severity: 'LOW', msg: `Permission \`${p}\` is defined but granted to no role.` });
  }
  // LOW: frontend references a permission that does not exist in the seed.
  for (const p of diff(frontend, seeded)) {
    items.push({ severity: 'LOW', msg: `Frontend references permission \`${p}\` that is not defined in the seed.` });
  }
  // INFO: backend-enforced permission with no frontend gating (endpoint reachable but not surfaced/guarded in UI).
  // `auth.me` is universal (held by every authenticated user) — nothing to gate.
  const GATING_EXEMPT = new Set(['auth.me']);
  for (const p of diff(usedBackend, frontend)) {
    if (GATING_EXEMPT.has(p)) continue;
    items.push({ severity: 'INFO', msg: `Permission \`${p}\` is enforced by the backend but never referenced in the frontend (no UI gating).` });
  }

  const summary = `Backend-used: ${usedBackend.length} (decorator ${sortUniq(decoratorPerms).length} + imperative ${sortUniq(imperativePerms).length}) · seeded: ${seeded.length} · granted: ${granted.length} · frontend: ${frontend.length}.`;
  return section('RBAC triangle (decorator ∪ imperative ↔ seed ↔ grants ↔ frontend)', summary, items);
}
