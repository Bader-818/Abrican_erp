# Abrican ERP — Self‑Hosting Guide (on‑premise server, whitelisted users)

Run the whole system on **your own server**, reachable only by whitelisted users:
on‑site staff over the office **LAN**, remote staff over a **WireGuard VPN**. There is
**no public web exposure** — the app answers only on the LAN and the VPN, behind TLS, and
every request is filtered three ways:

1. **Network allowlist** — the Caddy reverse proxy accepts only the office‑LAN and VPN
   subnets; everything else gets `403`.
2. **VPN keys** — a remote user reaches the app only if you issued them a WireGuard key.
3. **Application accounts + RBAC** — only user accounts you create can log in, each limited
   to its role's permissions.

> Companion files (all in this repo): [`deploy/docker-compose.tls.yml`](../deploy/docker-compose.tls.yml),
> [`deploy/Caddyfile`](../deploy/Caddyfile), [`deploy/backup.sh`](../deploy/backup.sh).
> Base stack: [`docker-compose.prod.yml`](../docker-compose.prod.yml). See also
> [DEPLOYMENT.md](../DEPLOYMENT.md) and [PROJECT-STATUS.md](PROJECT-STATUS.md).

```
                         ┌──────────────── your server (LAN 192.168.10.20) ─────────────────┐
 on‑site user ──LAN────▶ │  Caddy :443  ──(allow LAN + VPN only)──▶ frontend(nginx) ─┬─▶ SPA │
 (192.168.10.x)          │  (internal TLS)                                            └─▶/api─┼─▶ backend:3000 ─▶ db:5432
                         │                                                                   │        └─▶ gotenberg:3000 (PDF)
 remote user ──Internet──▶ WireGuard :51820/udp ──▶ VPN 10.8.0.x ──▶ (same Caddy :443) ──────┘
 (has a VPN key)         └───────────────────────────────────────────────────────────────────┘
```

---

## 1. Server requirements

### Hardware
| | Minimum (≤ 25 users) | Recommended (25–100 users) |
|---|---|---|
| CPU | 2 vCPU / cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Disk | 40 GB **SSD** | 100 GB **SSD** (+ separate backup disk) |

- **SSD is required** — PostgreSQL is latency‑sensitive.
- Keep **≥ 2× the database size free** for backups and Postgres working space.
- **Gotenberg** (PDF engine) is Chromium‑based and briefly uses ~0.5–1 GB RAM per render — the
  4 GB minimum assumes light concurrent PDF use; pick 8 GB if invoices/quotes are generated often.
- For a real production box: **RAID‑1** (or ZFS mirror) for the data disk and a **UPS**.

### Operating system
- **Ubuntu Server 24.04 LTS** (recommended) — commands below assume it. Debian 12 or
  Ubuntu 22.04 work with the same steps.
- 64‑bit x86‑64 or ARM64.

### Network
- A **static LAN IP** for the server (e.g. `192.168.10.20`) — set it in your router/DHCP
  reservation or netplan.
- To let **remote** users in, one UDP port (`51820/udp`, WireGuard) must be reachable from
  where they are. Either:
  - **port‑forward `51820/udp`** on the office internet router → the server's LAN IP, **or**
  - if you already have a corporate VPN into the LAN, remote users use that and you can skip
    WireGuard (they'll appear on the LAN and the LAN allowlist already covers them).
- No other inbound port needs to face the internet. **Port 443 stays on the LAN/VPN only.**

### Software (installed in the steps below)
- **Docker Engine + Compose plugin** (v2.24.4+) — runs the whole app, Caddy, Gotenberg.
- **ufw** (firewall), **wireguard** (VPN), plus `git`, `openssl`, `curl`.

---

## 2. Step 0 — Provision & harden the OS

SSH in as your admin user, then:

```bash
sudo apt update && sudo apt -y upgrade

# Create a non-root sudo user for day-to-day admin (skip if you already have one).
sudo adduser abrican-admin
sudo usermod -aG sudo abrican-admin

# Enable automatic security updates.
sudo apt -y install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

**Harden SSH** (`/etc/ssh/sshd_config`): set `PermitRootLogin no` and
`PasswordAuthentication no` (use SSH keys). Then `sudo systemctl restart ssh`.
Make sure your key works **before** disabling passwords.

Set the static LAN IP (example with netplan — adjust interface/addresses):
```bash
sudo nano /etc/netplan/00-installer-config.yaml   # set a static address, e.g. 192.168.10.20/24
sudo netplan apply
```

---

## 3. Step 1 — Install Docker

```bash
# Docker's official repo (ships a current Compose plugin).
curl -fsSL https://get.docker.com | sudo sh

# Let the admin user run docker without sudo (re-login afterwards).
sudo usermod -aG docker "$USER"

# Verify (need Compose v2.24.4+ for the !reset tag used by the TLS overlay).
docker --version
docker compose version
```

---

## 4. Step 2 — Firewall (ufw)

```bash
sudo apt -y install ufw

sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH — restrict to your admin subnet (change the CIDR).
sudo ufw allow from 192.168.10.0/24 to any port 22 proto tcp

# HTTPS — only from the office LAN and the VPN subnet.
sudo ufw allow from 192.168.10.0/24 to any port 443 proto tcp
sudo ufw allow from 10.8.0.0/24    to any port 443 proto tcp

# WireGuard — the one port remote users need (only if using WireGuard).
sudo ufw allow 51820/udp

sudo ufw enable
sudo ufw status verbose
```

> ⚠️ **Docker + ufw caveat.** Docker publishes container ports by editing iptables directly
> and can **bypass ufw**. This deployment avoids that by binding Caddy to the **LAN IP only**
> (`${SERVER_LAN_IP}:443:443` in the overlay) instead of `0.0.0.0`, and the Caddy config
> also enforces the subnet allowlist at the application layer. Do **not** change those
> bindings to `0.0.0.0` without adding matching `DOCKER-USER` iptables rules.

---

## 5. Step 3 — Get the code & configure secrets

```bash
sudo mkdir -p /opt/abrican && sudo chown "$USER" /opt/abrican
git clone <your-repo-url> /opt/abrican
cd /opt/abrican

cp .env.production.example .env.production
```

Edit **`.env.production`** and set real values:

```bash
# Generate strong secrets:
openssl rand -hex 32   # JWT_ACCESS_SECRET  (run twice, one per JWT secret)
openssl rand -hex 24   # POSTGRES_PASSWORD  (also paste into DATABASE_URL)
```

Fill in, at minimum:
- `POSTGRES_PASSWORD` **and** the same value inside `DATABASE_URL`.
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (32‑byte hex each).
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` (strong; you'll change it at first login).
- `CORS_ORIGINS=https://erp.abrican.local` and `VITE_API_BASE_URL=/api/v1`.
- **Add these two lines** (used by the TLS overlay):
  ```
  SERVER_LAN_IP=192.168.10.20
  HTTP_PORT=8080          # unused now (frontend isn't published) but keep it set
  ```

> 🔒 `.env.production` holds every secret — it stays on the server, is already git‑ignored,
> and must never be committed or pasted into chats/tickets. Use per‑environment secrets;
> never reuse dev/UAT values.

---

## 6. Step 4 — TLS + allowlist config

Edit **[`deploy/Caddyfile`](../deploy/Caddyfile)**:
- Change the hostname `erp.abrican.local` to whatever internal name you'll use.
- Set the two allowlisted CIDRs to your **office LAN** and **VPN** subnets.

The stack uses Caddy's **internal CA** (no public certificate, no internet needed). Clients
must trust that CA once — covered in §9.

---

## 7. Step 5 — Build & start

```bash
cd /opt/abrican
docker compose -f docker-compose.prod.yml -f deploy/docker-compose.tls.yml \
  --env-file .env.production up -d --build
```

On first boot the backend runs `prisma migrate deploy`, then seeds the RBAC catalogue + the
admin user (idempotent). Watch it come up:

```bash
docker compose -f docker-compose.prod.yml -f deploy/docker-compose.tls.yml \
  --env-file .env.production ps
docker compose -f docker-compose.prod.yml -f deploy/docker-compose.tls.yml \
  --env-file .env.production logs -f backend
```

Once the admin database is established, set `SEED_ON_START=false` in `.env.production` and
`... up -d` again so demo data isn't re‑checked on every restart.

> 💡 Define an alias to save typing:
> ```bash
> alias dc='docker compose -f docker-compose.prod.yml -f deploy/docker-compose.tls.yml --env-file .env.production'
> # then: dc ps   |   dc logs -f   |   dc up -d --build   |   dc down
> ```

---

## 8. Step 6 — WireGuard VPN (remote users)

Skip this section if remote users already reach the LAN via an existing corporate VPN.

**Install & key the server:**
```bash
sudo apt -y install wireguard
wg genkey | sudo tee /etc/wireguard/server.key | wg pubkey | sudo tee /etc/wireguard/server.pub
sudo chmod 600 /etc/wireguard/server.key
```

**Server config** `/etc/wireguard/wg0.conf` (replace `<SERVER_PRIVATE_KEY>` and the LAN
interface name `eth0` if different):
```ini
[Interface]
Address = 10.8.0.1/24
ListenPort = 51820
PrivateKey = <SERVER_PRIVATE_KEY>
# Let VPN clients reach the LAN and return traffic:
PostUp   = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# One [Peer] block per user — added below.
```
```bash
echo 'net.ipv4.ip_forward=1' | sudo tee /etc/sysctl.d/99-wg.conf && sudo sysctl --system
sudo systemctl enable --now wg-quick@wg0
```

**Add a remote user** (repeat per person; hand them the generated client file over a secure
channel):
```bash
# On the server: make a keypair for the user and register them as a peer.
NAME=fatima; IP=10.8.0.10          # give each user a unique 10.8.0.x
wg genkey | tee /tmp/$NAME.key | wg pubkey > /tmp/$NAME.pub
sudo wg set wg0 peer "$(cat /tmp/$NAME.pub)" allowed-ips $IP/32
sudo wg-quick save wg0             # persist the peer into wg0.conf

cat <<EOF
# --- give this to $NAME as $NAME.conf (WireGuard app: Import tunnel) ---
[Interface]
PrivateKey = $(cat /tmp/$NAME.key)
Address = $IP/32
# Optional: point them at an internal DNS server, or use a hosts entry (§9).

[Peer]
PublicKey = $(sudo cat /etc/wireguard/server.pub)
Endpoint = <SERVER_PUBLIC_IP_OR_DDNS>:51820
# Route only the app's LAN + the VPN subnet through the tunnel (split tunnel):
AllowedIPs = 192.168.10.0/24, 10.8.0.0/24
PersistentKeepalive = 25
EOF
rm /tmp/$NAME.key /tmp/$NAME.pub
```

`<SERVER_PUBLIC_IP_OR_DDNS>` is the office's public IP (or dynamic‑DNS name) that
port‑forwards `51820/udp` to the server.

---

## 9. Step 7 — Hostname & trusting the internal certificate

Users browse to **`https://erp.abrican.local`**. Two things must be true on each device:

**(a) The name must resolve to the server's LAN IP.** Easiest options:
- Add an **A record** `erp.abrican.local → 192.168.10.20` on your internal DNS / router, **or**
- add a hosts‑file line on each device:
  `192.168.10.20  erp.abrican.local` (`/etc/hosts`, or `C:\Windows\System32\drivers\etc\hosts`).

**(b) The device must trust Caddy's internal root CA** (otherwise the browser shows a warning).
Export the root once from the running Caddy and distribute it to devices:
```bash
dc exec caddy cat /data/caddy/pki/authorities/local/root.crt > abrican-root.crt
```
Install `abrican-root.crt` as a trusted **root** certificate (Windows: *Trusted Root
Certification Authorities*; macOS: Keychain → *Always Trust*; iOS/Android: install + enable
trust). Push it via MDM/Group Policy if you have one. *(Alternative: accept the browser
warning each time — fine for a quick pilot, not for daily use.)*

---

## 10. Step 8 — First login & the user whitelist (app layer)

1. Browse to `https://erp.abrican.local`, log in as `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. You're forced to **set a new admin password** immediately.
3. Turn on **MFA** for the admin (Settings → Security), and for every privileged account.
4. **Create a user account for each whitelisted person** (Admin → Users), assign the right
   **role** (Finance Manager, Operations Manager, Field Supervisor, Viewer/Auditor, …). Only
   accounts you create here can log in — this is the application‑level whitelist.

---

## 11. Step 9 — Backups & restore

Automate nightly backups of the database **and** uploaded files with the provided script:
```bash
chmod +x /opt/abrican/deploy/backup.sh
sudo mkdir -p /var/backups/abrican

# Test it once:
sudo BACKUP_DIR=/var/backups/abrican /opt/abrican/deploy/backup.sh

# Schedule daily at 01:30:
echo '30 1 * * * root BACKUP_DIR=/var/backups/abrican /opt/abrican/deploy/backup.sh >> /var/log/abrican-backup.log 2>&1' \
  | sudo tee /etc/cron.d/abrican-backup
```
**Copy `/var/backups/abrican` off‑box** (another disk / NAS / secure location) — a backup on
the same machine doesn't survive a disk failure.

**Restore the database** from a dump:
```bash
dc exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists \
  < /var/backups/abrican/db_YYYY-MM-DD_HHMM.dump
```
Restore files by extracting `storage_*.tgz` into the `backend_storage` volume.

---

## 12. Step 10 — Operations

```bash
dc ps                 # status
dc logs -f            # tail all logs   (dc logs -f backend for one service)
dc restart caddy      # after editing deploy/Caddyfile
```

**Update to new code:**
```bash
cd /opt/abrican && git pull
dc up -d --build      # runs any new DB migrations automatically on backend boot
```
Take a backup (§11) **before** updating.

**Health:** the backend exposes `/api/v1/health`; check from the server with
`curl -k https://erp.abrican.local/api/v1/health` (once the name resolves locally).

---

## 13. Managing the whitelist (add / remove a user)

**Add** a user:
- On‑site only → just create their **app account** (§10). The LAN allowlist already covers them.
- Remote → also issue a **WireGuard key** (§8) and send them the client config.

**Remove / off‑board** a user:
1. **App:** Admin → Users → set the account **Inactive** (or delete), and “log out everywhere.”
2. **VPN (if remote):** revoke their key on the server:
   ```bash
   sudo wg set wg0 peer "<their PublicKey>" remove && sudo wg-quick save wg0
   ```
That instantly cuts both their network path and their login.

---

## 14. Hardening checklist
- [ ] Root SSH disabled, key‑only auth, SSH limited to the admin subnet (§2, §4).
- [ ] `ufw` enabled; 443 restricted to LAN + VPN; only `51820/udp` faces the internet (§4).
- [ ] Caddy bound to the LAN IP, subnet allowlist in `Caddyfile` (§4, §6).
- [ ] Strong unique `.env.production` secrets; admin password rotated; **MFA on** for admins (§5, §10).
- [ ] Internal root CA trusted on client devices (§9).
- [ ] Nightly backups running **and copied off‑box**; a restore has been test‑run (§11).
- [ ] `unattended-upgrades` on; a plan to `git pull && dc up -d --build` for app updates (§2, §12).
- [ ] Real client/employee data only after confirming this meets **PDPL / in‑Kingdom**
      obligations (see [PROJECT-STATUS.md](PROJECT-STATUS.md) §4D) and disk **encryption at rest**
      is in place (LUKS on the data disk).

---

## 15. Troubleshooting
| Symptom | Likely cause / fix |
|---|---|
| `403 Access denied` from Caddy | Your source IP isn't in the `Caddyfile` allowlist — add the LAN/VPN CIDR, `dc restart caddy`. |
| Browser certificate warning | Caddy's internal root CA isn't trusted on the device — install it (§9). |
| Site name won't resolve | Missing internal DNS A‑record or hosts entry (§9). |
| PDFs fail to generate | The `gotenberg` service isn't up — `dc ps`; it's added by the TLS overlay, so include **both** `-f` files in every command. |
| PDF has no logo | The logo mount/`COMPANY_LOGO_PATH` isn't set — it's in the overlay; ensure `deploy/docker-compose.tls.yml` is included. |
| `!reset` not recognized | Docker Compose older than v2.24.4 — update Docker (§3). |
| Remote user can't connect | `51820/udp` not port‑forwarded to the server, or wrong `Endpoint`/`AllowedIPs` in their client config (§8). |
| Login works on LAN, not on VPN | VPN subnet missing from the `Caddyfile` allowlist and/or `ufw` 443 rule (§4, §6). |
```
