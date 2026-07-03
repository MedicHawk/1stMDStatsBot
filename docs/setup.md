# Local Setup

1. Install Node.js 20 or newer and MySQL 8.
2. Create a database user for local development.
3. Copy `.env.example` to `.env` and fill in Discord, MySQL, and optional BattleMetrics values.
4. Run `npm install`.
5. Load `src/db/schema.sql` into MySQL.
6. Register slash commands with `npm run register-commands`.

Admin reset command:

```text
/admin reset-all confirm: RESET ALL
```

Use `keep_accounts: true` to keep linked Discord/Reforger accounts while clearing servers and server-scoped stats.

Speak as the bot:

```text
/admin say channel: #announcements message: Server restart in 10 minutes.
```

Mentions are suppressed by default. Set `allow_mentions: true` when you intentionally want the bot message to ping users or roles.

Session and leaderboard diagnostics:

```text
/admin open-sessions
/admin recent-events type: all
/admin close-stale-sessions confirm: CLOSE older_than_minutes: 60
/admin refresh-leaderboards
/admin refresh-status
```

Use these to inspect active playtime sessions, review recent medical/support event rows, clean stale open sessions, manually refresh cached leaderboard payloads, and force status embed/channel/presence updates.

Generate a fresh server API key:

```text
/server rotate-key server_id: hosted-main confirm: ROTATE
```

The new raw key is only shown in the ephemeral Discord response. Copy it into the game server profile config and restart that Reforger server.

Generate a complete paste-ready game server config, including a fresh API key:

```text
/server config server_id: hosted-main confirm: GENERATE
```

This rotates the server API key and returns the full `$profile:MDST_StatsBot_Config.json` content in an ephemeral Discord response. If the server does not exist yet, it creates it first. Use optional `name`, `category`, and `battlemetrics_id` values to control the created server row.

Status channels:

```text
/statuschannel set server_id: pvp-1 channel: #server-status
```

The bot posts one status embed there and edits it on each refresh. When `DISCORD_STATUS_RENAME_ENABLED=true`, it also renames the channel with the latest status and player count, such as `🟢-1stmd-pvp-12-64` or `🔴-1stmd-pvp-0-64`. The bot role needs Discord's Manage Channels permission for channel-name updates.

When `DISCORD_STATUS_PRESENCE_ENABLED=true`, the bot rich presence also shows aggregate server status, such as online server count and total players.

Leaderboard channels work the same way: `/leaderboardchannel set` maps a channel, then the bot maintains one refreshed leaderboard message for that server instead of posting a new message each interval.

Set `DISCORD_LEADERBOARD_TYPES` to choose which boards auto-publish, such as `kills,aikills,hours,xp,support,treatment,support_amount`. The `/leaderboard` command also supports medical boards for revives, bandages, tourniquets, heals, and treatment amount.

Medical/support feed channels:

```text
/supportfeed set server_id: hosted-main channel: #support-feed
/supportfeed enable server_id: hosted-main
```

When `DISCORD_SUPPORT_FEED_ENABLED=true`, the bot posts new medical/support rows from the event tables and marks each row posted after Discord accepts it.
7. Start the API with `npm run api`.
8. Start the bot with `npm run bot`.

For the first test server, run `/category list`, then `/server add` in Discord. The API key you provide is stored hashed and used by the Reforger server mod in the `x-api-key` header.

## Smoke Test Path

After loading the schema:

1. Provision a local server and save the printed API key:

   ```bash
   npm run provision-server -- local-test "Local Test Server" test
   ```

2. Start the API:

   ```bash
   npm run api
   ```

3. In another terminal, send a sample authenticated stat batch:

   ```bash
   npm run smoke-test -- http://localhost:3000 local-test YOUR_PRINTED_API_KEY
   ```

4. Print table counts:

   ```bash
   npm run stats-summary
   ```

5. Refresh leaderboard cache:

   ```bash
   npm run refresh-leaderboards
   ```
