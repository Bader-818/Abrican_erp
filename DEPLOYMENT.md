# Deploying Abrican ERP

The production stack (`docker-compose.prod.yml`) builds the **production** image
stages and runs same-origin: nginx serves the compiled SPA and proxies `/api`
to the backend. Only the web port is published — the database and backend stay
on the internal docker network.

```
            ┌─────────────────────────── server ───────────────────────────┐
 browser ──▶│  TLS proxy (Caddy/Traefik) ──▶ frontend(nginx :80) ─┬─▶ SPA    │
  (https)   │                                                      └─▶ /api ──┼─▶ backend:3000 ─▶ db:5432
            └───────────────────────────────────────────────────────────────┘
```

## 1. Prerequisites
- A Linux host (x86_64 or ARM) with Docker + Docker Compose.
- A domain name pointed at the host (for HTTPS).

## 2. Configure secrets
```bash
cp .env.production.example .env.production
# Fill in real values. Generate secrets with:
openssl rand -hex 32   # JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
openssl rand -hex 24   # POSTGRES_PASSWORD (also update it inside DATABASE_URL)
```
Set `ADMIN_EMAIL` / `ADMIN_PASSWORD` and `CORS_ORIGINS` to your public URL.
If `ADMIN_PASSWORD` is left empty the seed generates a random password and
prints it once in the backend logs; either way the admin must set a new
password at first login.

Secrets handling (pentest P-08):
- `.env.production` stays on the host only — never commit it, never paste
  secrets into chats/tickets; rotate anything that leaks.
- Every secret is per-environment: never reuse dev/UAT values in production.
- Prefer a managed secrets store (platform env vars, Vault, cloud secret
  manager) over an on-disk file when the platform offers one.

## 3. Build & start
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```
On first boot the backend runs `prisma migrate deploy` then seeds the RBAC
catalogue + admin user (idempotent). Set `SEED_ON_START=false` afterwards if you
don't want the demo data re-checked on each restart.

The app is now on `http://<host>:${HTTP_PORT}`. **Do not expose plain HTTP
publicly** — put TLS in front (next step).

## 4. HTTPS (required for real use)
The refresh-token cookie is `Secure` + `SameSite=Lax` in production, so it only
works over HTTPS and same-origin (which this stack already is). Terminate TLS
with a reverse proxy. Easiest is **Caddy** (automatic Let's Encrypt):

`/etc/caddy/Caddyfile`
```
erp.yourcompany.com {
    reverse_proxy localhost:8080   # set HTTP_PORT=8080 in .env.production
}
```
```bash
sudo apt install caddy   # or run caddy in its own container
sudo systemctl reload caddy
```
Caddy fetches and renews certificates automatically. Traefik or nginx +
certbot work equally well.

## 5. Operations
```bash
# logs
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f
# update to new code
git pull && docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
# stop
docker compose -f docker-compose.prod.yml --env-file .env.production down
```

### Backups
The database lives in the `db_data` volume and uploaded files in
`backend_storage`. Back both up regularly, e.g.:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec db pg_dump -U abrican abrican_erp > backup_$(date +%F).sql
```

## Notes & current limitations
- **Same-origin is assumed.** If you ever split the SPA and API onto different
  domains, the `SameSite=Lax` cookie will block token refresh — switch it to
  `SameSite=None; Secure` in `auth.service.ts` and set `CORS_ORIGINS` accordingly.
- **Desktop-first UI.** Data tables are not optimized for phones.
- **Local file storage.** Uploads live on the `backend_storage` volume; for
  multi-server setups swap `StorageService` for an S3 implementation (the
  `IStorageService` interface already abstracts this).
