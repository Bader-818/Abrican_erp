// Enum parity: every Prisma enum should match its frontend TS union (by name).
import { BACKEND, FRONTEND, read, section, sortUniq } from './lib.mjs';

function prismaEnums(schema) {
  const map = {};
  const re = /enum\s+(\w+)\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(schema)) !== null) {
    const name = m[1];
    const values = m[2]
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, '').trim())
      .filter((l) => l && /^[A-Z0-9_]+$/.test(l));
    map[name] = sortUniq(values);
  }
  return map;
}

function tsUnions(text) {
  const map = {};
  const aliases = {}; // `export type X = Y` (X is an alias of union Y)
  const re = /export\s+type\s+(\w+)\s*=/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    const rest = text.slice(m.index + m[0].length);
    const boundary = rest.search(/\n\s*\n|\nexport |\ninterface |\nconst |\nfunction /);
    const body = (boundary >= 0 ? rest.slice(0, boundary) : rest).trim();
    if (body.includes("'")) {
      const values = (body.match(/'([^']+)'/g) || []).map((s) => s.replace(/'/g, ''));
      if (values.length) map[name] = sortUniq(values);
    } else {
      const alias = body.match(/^(\w+)\s*$/);
      if (alias) aliases[name] = alias[1];
    }
  }
  // Resolve one level of aliasing (e.g. `EquipmentStatus = VehicleStatus`).
  for (const [name, target] of Object.entries(aliases)) {
    if (map[target]) map[name] = map[target];
  }
  return map;
}

export function enumParity() {
  const prisma = prismaEnums(read(`${BACKEND}/prisma/schema.prisma`));
  const fe = tsUnions(read(`${FRONTEND}/src/types/index.ts`));

  const items = [];
  for (const [name, pvals] of Object.entries(prisma)) {
    const fvals = fe[name];
    if (!fvals) {
      items.push({ severity: 'INFO', msg: `Prisma enum \`${name}\` has no matching frontend union type (may be backend-only).` });
      continue;
    }
    const missingInFe = pvals.filter((v) => !fvals.includes(v));
    const extraInFe = fvals.filter((v) => !pvals.includes(v));
    if (missingInFe.length || extraInFe.length) {
      items.push({
        severity: 'HIGH',
        msg: `Enum \`${name}\` drift between Prisma and frontend.`,
        evidence: `missing in frontend: [${missingInFe.join(', ') || '—'}] · extra in frontend: [${extraInFe.join(', ') || '—'}]`,
      });
    }
  }

  const summary = `Prisma enums: ${Object.keys(prisma).length} · frontend unions: ${Object.keys(fe).length}.`;
  return section('Enum parity (Prisma ↔ frontend TS unions)', summary, items);
}
