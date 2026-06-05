# Raspberry Pi Deployment

This guide assumes a Raspberry Pi 4 or 5 running 64-bit Raspberry Pi OS Lite, with a domain pointed at your home public IP or a Cloudflare Tunnel terminating on the Pi.

## Install Runtime

```bash
sudo apt update
sudo apt install -y git curl nginx mariadb-server
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## Clone Project

```bash
sudo mkdir -p /opt/1stmd-stats-bot
sudo chown "$USER:$USER" /opt/1stmd-stats-bot
git clone REPLACE_WITH_REPO_URL /opt/1stmd-stats-bot
cd /opt/1stmd-stats-bot
npm ci
cp .env.example .env
nano .env
```

Set production values in `.env`:

```env
NODE_ENV=production
LOG_LEVEL=info
API_PORT=3000
PUBLIC_API_URL=https://stats.your-domain.example
TRUST_PROXY=1

DISCORD_TOKEN=replace_with_discord_bot_token
DISCORD_CLIENT_ID=replace_with_discord_application_client_id
DISCORD_GUILD_ID=replace_with_discord_guild_id

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=stats_bot
MYSQL_PASSWORD=replace_with_strong_password
MYSQL_DATABASE=arma_stats
MYSQL_CONNECTION_LIMIT=10

BATTLEMETRICS_TOKEN=
LINK_CODE_MINUTES=15
LEADERBOARD_REFRESH_MINUTES=10
DISCORD_AUTO_PUBLISH_ENABLED=true
DISCORD_STATUS_POST_MINUTES=5
DISCORD_STATUS_RENAME_ENABLED=true
DISCORD_STATUS_PRESENCE_ENABLED=true
DISCORD_STATUS_OFFLINE_AFTER_MINUTES=5
DISCORD_LEADERBOARD_POST_MINUTES=15
DISCORD_LEADERBOARD_TYPES=kills,aikills,hours

SMOKE_SERVER_ID=hosted-main
SMOKE_API_KEY=replace_after_provision_server
```

## Create Database User

```bash
sudo mariadb
```

```sql
CREATE DATABASE IF NOT EXISTS arma_stats CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'stats_bot'@'localhost' IDENTIFIED BY 'replace_with_strong_password';
GRANT ALL PRIVILEGES ON arma_stats.* TO 'stats_bot'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## Initialize App Data

```bash
npm run init-db
npm run provision-server -- hosted-main "1stMD Hosted Server" pve
```

Copy the printed `apiKey` into `.env` as `SMOKE_API_KEY`. Use the same key in the Reforger `MDST_StatsGameModeComponent`.

## Start Services

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Run the command printed by `pm2 startup`, then confirm:

```bash
pm2 status
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/health/db
```

## Nginx Reverse Proxy

Create `/etc/nginx/sites-available/1stmd-stats-bot`:

```nginx
server {
    listen 80;
    server_name stats.your-domain.example;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/1stmd-stats-bot /etc/nginx/sites-enabled/1stmd-stats-bot
sudo nginx -t
sudo systemctl reload nginx
```

## HTTPS

If your domain points directly to the Pi through router port forwarding, use Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d stats.your-domain.example
```

If you use Cloudflare Tunnel instead, keep Nginx on local port 80 and point the tunnel hostname at `http://127.0.0.1:80`.

## Reforger Component Values

```text
Api Base Url: https://stats.your-domain.example/
Server Id: hosted-main
Api Key: the provisioned apiKey
Stats Enabled: checked
```

## Verification

After the hosted Reforger server starts, check:

```bash
curl https://stats.your-domain.example/api/public/servers
pm2 logs 1stmd-api
```

`last_heartbeat_at` should update within one heartbeat interval.
