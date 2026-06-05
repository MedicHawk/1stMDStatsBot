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

Generate a fresh server API key:

```text
/server rotate-key server_id: hosted-main confirm: ROTATE
```

The new raw key is only shown in the ephemeral Discord response. Copy it into the game server profile config and restart that Reforger server.

Generate a complete paste-ready game server config, including a fresh API key:

```text
/server config server_id: hosted-main confirm: GENERATE
```

This rotates the server API key and returns the full `$profile:MDST_StatsBot_Config.json` content in an ephemeral Discord response.
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
