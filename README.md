# 1stMD Arma Reforger Stats Bot

Scaffold for a scalable multi-server Arma Reforger statistics platform:

```text
Arma Reforger server mod -> Express API -> MySQL -> Discord bot
```

## What Is Included

- CommonJS Node.js project structure
- Express API with per-server API key authentication
- MySQL schema for servers, categories, players, links, seasons, sessions, stats, mods, cache, and audits
- Discord slash command skeletons for linking, profiles, leaderboards, status, mods, seasons, and admin workflows
- Services for servers, linking, stats ingestion, seasons, leaderboards, and BattleMetrics
- Documentation and example API payloads

## Commands

User-facing commands include `/link`, `/unlink`, `/profile`, `/stats`, `/leaderboard`, `/tophours`, `/topweapons`, `/topvehicles`, `/topdistance`, `/serverstatus`, `/mods`, and `/season current`.

Admin commands include `/server add`, `/server list`, `/server enable`, `/server disable`, `/category add`, `/category remove`, `/category list`, `/season create`, `/season close`, and placeholders for audited stat and channel management.

User-facing joke labels should stay neutral or playful, such as `Certified Bullet Magnet` or `Combat Effectiveness Review`.

## Local Development

See [docs/setup.md](docs/setup.md).

Useful scripts:

- `npm run provision-server -- local-test "Local Test Server" test`
- `npm run smoke-test -- http://localhost:3000 local-test YOUR_API_KEY`
- `npm run stats-summary`
- `npm run refresh-leaderboards`
- `npm run poll-battlemetrics`

## API Examples

See [docs/api.md](docs/api.md).

## Reforger Mod Notes

See [docs/reforger-mod-integration.md](docs/reforger-mod-integration.md).

## Raspberry Pi Hosting

See [docs/raspberry-pi-deployment.md](docs/raspberry-pi-deployment.md) for cloning this repo onto a Pi, configuring MariaDB, running the API/bot with PM2, and putting the API behind Nginx and HTTPS.
