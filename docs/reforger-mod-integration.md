# Reforger Mod Integration

The mod should send gameplay events to the Express API, not to Discord directly.

## Required Headers

- `x-server-id`
- `x-api-key`

Each server gets its own API key. Rotate keys if a server config leaks.

## Player Linking Flow

1. Player runs `/link` in Discord.
2. Bot returns an ephemeral one-time code.
3. Player enters the code in-game through a chat command or UI.
4. Mod sends the code and stable Reforger/platform player ID to `/api/link/verify`.
5. API stores the Discord to Reforger account link.

## Movement Sampling

Sample player position every 5-10 seconds.

Before sending movement deltas:

- ignore dead players
- ignore teleport/admin jumps
- reject impossible speed spikes
- classify distance as on-foot or mounted
- track passenger distance separately when detectable

TODO: Add the game-side script that computes trusted movement deltas and posts them to `/api/ingest/movement`.

## Status And Mods

Use `/api/status/heartbeat` for player counts, map/scenario, and uptime. Use `/api/status/mods` whenever the loaded mod list changes or on server start.

BattleMetrics is useful for public visibility, but gameplay stats should come from the mod/API path.
