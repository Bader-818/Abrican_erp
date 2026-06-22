// Shared helpers for the consistency-audit scripts. Pure static analysis: these
// read source files and never touch the database or a running app.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const REPO = join(here, '..', '..', '..'); // backend/scripts/audit → repo root
export const BACKEND = join(REPO, 'backend');
export const FRONTEND = join(REPO, 'frontend');

/** Recursively list files under `dir` matching `re`, skipping node_modules/dist/.git. */
export function walk(dir, re, acc = []) {
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, re, acc);
    else if (re.test(name)) acc.push(full);
  }
  return acc;
}

export function read(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

export const rel = (file) => relative(REPO, file);

/** All matches of a global regex, returning capture group 1. */
export function matchAll(text, re) {
  const out = [];
  let m;
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  while ((m = r.exec(text)) !== null) out.push(m[1]);
  return out;
}

export const sortUniq = (arr) => [...new Set(arr)].sort();
export const diff = (a, b) => a.filter((x) => !b.includes(x)); // in a, not in b

/** Render a finding section as markdown. `items` is an array of {severity,msg,evidence?}. */
export function section(title, summary, items) {
  const lines = [`## ${title}`, '', summary, ''];
  if (items.length === 0) {
    lines.push('✅ No discrepancies found.', '');
  } else {
    for (const it of items) {
      const sev = it.severity ? `**[${it.severity}]** ` : '';
      lines.push(`- ${sev}${it.msg}`);
      if (it.evidence) lines.push(`  - ${it.evidence}`);
    }
    lines.push('');
  }
  return { md: lines.join('\n'), count: items.length };
}
