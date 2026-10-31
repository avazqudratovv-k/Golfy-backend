# Deploying Golfy on a single VPS

Ubuntu VPS, host nginx + certbot, Docker for the two APIs. MongoDB stays on Atlas (no Mongo container).

```
browser ──https──▶ nginx ─┬─ golfy.76-13-198-17.sslip.io        static player build, /api/ ─▶ 127.0.0.1:4200 ─▶ api (container :3011)
                          └─ golfy-admin.76-13-198-17.sslip.io  static admin build,  /api/ ─▶ 127.0.0.1:4201 ─▶ admin-api (container :3012)
```

Everything is same-origin: the apps are built with `REACT_APP_API_URL=/api`, nginx strips the `/api/` prefix, and uploaded photos are served at `/api/uploads/...`. Cookies are first-party (`Secure`, `SameSite=Lax`).

Paths used below (change freely): backend repo `/opt/golfy-backend`, web roots `/var/www/golfy/player` and `/var/www/golfy/admin`, SSH user `deploy`.

## 1. One-time server setup

```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx git rsync
# Docker: https://docs.docker.com/engine/install/ubuntu/  (includes the compose plugin)
sudo usermod -aG docker "$USER"            # log out/in afterwards
sudo ufw allow 'Nginx Full' && sudo ufw allow OpenSSH   # only 80/443/22 are public; 4200/4201 are bound to 127.0.0.1
sudo mkdir -p /var/www/golfy/{player,admin}/releases && sudo chown -R "$USER": /var/www/golfy
```

Atlas: add the VPS public IP (76.13.198.17) to *Network Access*.

## 2. Backend

```bash
sudo git clone <your-backend-repo-url> /opt/golfy-backend && sudo chown -R "$USER": /opt/golfy-backend
cd /opt/golfy-backend
git checkout main                          # or deploy-prep until it is merged
cp .env.production.example .env.production
nano .env.production                       # MONGO_URL, SECRET_TOKEN, ADMIN_SIGNUP_SECRET (openssl rand -hex 32)
chmod 600 .env.production

# uploads live in ./data/uploads (bind mount); the container runs as uid 1000 (user "node")
mkdir -p data/uploads && sudo chown -R 1000:1000 data

docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps          # both "healthy"
curl -s http://127.0.0.1:4200/health; curl -s http://127.0.0.1:4201/health
```

### Demo data (seed) in production

The seed copies `seed-assets/` photos into `data/uploads/venues/seed/` and writes demo records (tagged `@seed.golfy.dev` / the venue names in `src/seed.ts`).

```bash
# first time / add demo data
docker compose -f docker-compose.prod.yml run --rm api node dist/seed.js
# wipe only the demo-tagged records and re-create them (real users/venues are untouched)
docker compose -f docker-compose.prod.yml run --rm api node dist/seed.js --reset
```

Demo logins are printed at the end (players `Password123!`, admins `Admin123!` unless `SEED_ADMIN_PASSWORD` is set). Change or delete the demo admins if the site is public.

## 3. nginx (HTTP first, certbot adds TLS)

`/etc/nginx/sites-available/golfy`:

```nginx
# ---------- player app ----------
server {
    listen 80;
    listen [::]:80;
    server_name golfy.76-13-198-17.sslip.io;

    root /var/www/golfy/player/current;
    index index.html;
    client_max_body_size 6m;

    # hashed CRA assets: cache for a year
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # API: the /api/ prefix is stripped by the trailing slash on proxy_pass
    location /api/ {
        proxy_pass http://127.0.0.1:4200/;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA deep links; index.html itself must never be cached
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
}

# ---------- admin app ----------
server {
    listen 80;
    listen [::]:80;
    server_name golfy-admin.76-13-198-17.sslip.io;

    root /var/www/golfy/admin/current;
    index index.html;
    client_max_body_size 6m;

    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4201/;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/golfy /etc/nginx/sites-enabled/golfy
sudo nginx -t && sudo systemctl reload nginx
```

### TLS

DNS for `*.76-13-198-17.sslip.io` resolves to the VPS automatically. Port 80 must be reachable.

```bash
sudo certbot --nginx --redirect --agree-tos -m you@example.com \
  -d golfy.76-13-198-17.sslip.io -d golfy-admin.76-13-198-17.sslip.io
sudo certbot renew --dry-run
```

Certbot rewrites the blocks to listen on 443 and adds the HTTP→HTTPS redirect. Both names go in one certificate; if you prefer one each, run certbot twice. Note that Let's Encrypt rate-limits per registered domain (`sslip.io` is shared), so keep the number of issuances low.

## 4. Frontends (build locally, rsync to the VPS)

The API base is baked in at build time; the shell variable overrides any local `.env`.

```bash
# player app
cd /Users/kenneth/Desktop/golfy-frontend
yarn install --frozen-lockfile
REACT_APP_API_URL=/api REACT_APP_SITE_URL=https://golfy.76-13-198-17.sslip.io yarn build

# admin app
cd /Users/kenneth/golfy-admin
yarn install --frozen-lockfile
REACT_APP_API_URL=/api yarn build
```

Upload as a timestamped release, then flip the `current` symlink (this also gives instant rollback):

```bash
HOST=deploy@76.13.198.17
REL=$(date +%Y%m%d-%H%M%S)

rsync -az --delete /Users/kenneth/Desktop/golfy-frontend/build/ $HOST:/var/www/golfy/player/releases/$REL/
ssh $HOST "ln -sfn /var/www/golfy/player/releases/$REL /var/www/golfy/player/current"

rsync -az --delete /Users/kenneth/golfy-admin/build/ $HOST:/var/www/golfy/admin/releases/$REL/
ssh $HOST "ln -sfn /var/www/golfy/admin/releases/$REL /var/www/golfy/admin/current"
```

Prune old releases occasionally: `ls -1dt /var/www/golfy/player/releases/* | tail -n +6 | xargs rm -rf`.

## 5. Update and rollback

**Backend update**

```bash
cd /opt/golfy-backend
git tag -f last-good                           # remember where we were
docker tag golfy-backend:prod golfy-backend:previous
git pull --ff-only
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

**Backend rollback**

```bash
git checkout last-good
docker compose -f docker-compose.prod.yml up -d --build
# or, without rebuilding: re-tag the saved image
#   docker tag golfy-backend:previous golfy-backend:prod && docker compose -f docker-compose.prod.yml up -d --no-build
```

**Frontend update:** rebuild and run the rsync block above. **Frontend rollback:** point the symlink at an older release:

```bash
ssh $HOST "ls -1t /var/www/golfy/player/releases | head"
ssh $HOST "ln -sfn /var/www/golfy/player/releases/<OLD> /var/www/golfy/player/current"   # same for admin
```

Logs: `docker compose -f docker-compose.prod.yml logs -f --tail 100 api admin-api` (rotated: 3 × 10 MB per container). Uploads are in `/opt/golfy-backend/data/uploads`; back that folder up.

## 6. Checklist

- [ ] Atlas Network Access allows 76.13.198.17
- [ ] `.env.production` filled in, `chmod 600`, never committed (it is in `.gitignore` and `.dockerignore`)
- [ ] `data/uploads` owned by uid 1000
- [ ] `docker compose ... ps` shows `api` and `admin-api` healthy; `ss -tlnp | grep -E '4200|4201'` shows `127.0.0.1` only
- [ ] `nginx -t` OK; certificate issued; HTTP redirects to HTTPS
- [ ] `https://golfy.76-13-198-17.sslip.io/api/health` and `https://golfy-admin.76-13-198-17.sslip.io/api/health` return `{"status":"ok",...}`
- [ ] Seed run (optional) and a venue photo loads (`/api/uploads/venues/seed/...`)
- [ ] Player login works and the cookie is `HttpOnly; Secure; SameSite=Lax` (DevTools → Application → Cookies)
- [ ] Reload a deep link such as `/venues` or `/credits` in both apps (no nginx 404)
- [ ] Admin signup requires `ADMIN_SIGNUP_SECRET`; demo admin passwords changed or demo admins removed
- [ ] Upload a venue photo in the admin app (≤ 5 MB) and see it in the player app (shared `data/uploads`)
- [ ] `sudo certbot renew --dry-run` passes
