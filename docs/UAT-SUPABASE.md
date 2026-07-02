# UAT on Supabase

Runbook for the **testing/UAT** database (managed Postgres on Supabase). UAT uses
**synthetic/demo data only** — no real client/employee data until we move to an in‑Kingdom
region for production.

## Connection
Use Supabase → **Settings → Database → Connection string → "Session pooler"** (IPv4,
port 5432). The app is a long‑running NestJS server, so the session pooler works for both
the app and Prisma migrations — **no `directUrl` / transaction pooler needed**.

**Percent‑encode special characters in the password** or the URL won't parse:
`@` → `%40`, `!` → `%21`, `#` → `%23`, `/` → `%2F`, etc. Append `?sslmode=require`.

```
DATABASE_URL=postgresql://postgres.<ref>:<ENCODED-PASSWORD>@<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

## App environment (UAT)
Do **not** reuse dev defaults (see docs/audit/PENTEST.md P‑01/P‑03):
```
NODE_ENV=production
DATABASE_URL=<the session-pooler URL above>
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ADMIN_EMAIL=admin@abrican.local
ADMIN_PASSWORD=<strong password for the UAT admin>
CORS_ORIGINS=<the UAT frontend URL>
GOTENBERG_URL=http://gotenberg:3000
STORAGE_ROOT=/app/storage
```

## Provision (one‑time, from repo root)
```bash
export DATABASE_URL='…session-pooler URL, password percent-encoded, ?sslmode=require'
# apply schema, seed RBAC+admin+demo data, load the Aramco contract pricing
docker compose exec -T -e DATABASE_URL="$DATABASE_URL" backend npx prisma migrate deploy
docker compose exec -T -e DATABASE_URL="$DATABASE_URL" backend npx prisma db seed
docker compose exec -T -e DATABASE_URL="$DATABASE_URL" backend node prisma/import-contract-6601000307.cjs
```
Verify: `docker compose exec -T db psql "$DATABASE_URL" -c "select count(*) from users;"`

## Run the app against UAT
- **Quick:** set the backend's `DATABASE_URL` to the Supabase URL and start the stack; the
  local `db` container becomes unused (can be removed from the compose run).
- **For remote testers:** deploy backend + frontend (Railway/Render/Fly) with the env above
  so testers reach a URL; point `CORS_ORIGINS` at the deployed frontend.

## Gotchas
- Free projects **pause after ~1 week idle** — un‑pause from the dashboard before a session; data persists.
- **Leave Row Level Security OFF** — the app connects as the DB owner via Prisma; enabling RLS would block queries.
- Use the **session pooler** host, not the raw direct host (which can be IPv6‑only).
- **Rotate the DB password before any production/real‑data use** and switch to an in‑Kingdom region then.
