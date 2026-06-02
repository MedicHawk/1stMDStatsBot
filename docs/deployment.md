# Deployment Notes

## Services

Run these as separate processes:

- Express API: `npm run api`
- Discord bot: `npm run bot`
- Leaderboard refresh: `npm run refresh-leaderboards` every 5-15 minutes
- BattleMetrics polling: `npm run poll-battlemetrics` every 1-5 minutes

## Secrets

Use `.env` or your host's secret manager for:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- MySQL credentials
- Optional `BATTLEMETRICS_TOKEN`

Never post Reforger server API keys in public Discord channels. `/server add` replies ephemerally, and the API key is stored hashed.

## Reforger Server Config

For each server:

- Set `Server ID` to the database `servers.server_id`.
- Set `API Key` to the raw key generated/provided during server setup.
- Set `API Base URL` to the public API endpoint.
- Keep movement sampling at 5-10 seconds unless performance testing says otherwise.

## Scheduled Jobs

Use Task Scheduler, systemd timers, cron, or your host scheduler.

Example intervals:

- `refresh-leaderboards`: every 10 minutes, plus after match end
- `poll-battlemetrics`: every 2 minutes

## First Production Check

1. Run `npm run stats-summary`.
2. Start API and bot.
3. Run `npm run smoke-test -- https://your-api.example local-test YOUR_API_KEY`.
4. Confirm the Discord bot can run `/serverstatus`, `/leaderboard`, `/topweapons`, and `/profile`.
