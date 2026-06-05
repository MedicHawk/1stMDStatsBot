# API Reference

All ingestion routes require:

- `x-server-id`: the configured `servers.server_id`
- `x-api-key`: the raw per-server API key. The database stores only a bcrypt hash.

Base URL for local development: `http://localhost:3000`.

## Health

`GET /health`

`GET /health/db`

Verifies API process and MySQL connectivity.

## Public Reads

`GET /api/public/servers`

Returns enabled server status rows.

`GET /api/public/servers/:serverId/mods`

Returns the last reported mod list for a server.

`GET /api/public/leaderboards/:type`

Returns live leaderboard rows by default. Add `?cached=true` to read the refreshed cache instead. Supported types include `kills`, `aikills`, `deaths`, `hours`, `revives`, and `distance`.

## Linking

`POST /api/link/verify`

```json
{
  "code": "A1B2C3D4",
  "player_reforger_id": "platform-or-reforger-stable-id",
  "player_name": "Current Display Name"
}
```

## Status

`POST /api/status/heartbeat`

```json
{
  "player_count": 42,
  "max_player_slots": 64,
  "scenario": "Conflict Everon",
  "uptime_seconds": 12345
}
```

`POST /api/status/mods`

```json
{
  "mods": [
    {
      "mod_id": "596B6FBBF889C1F2",
      "name": "Example Required Mod",
      "version": "1.0.3",
      "required": true
    }
  ]
}
```

## Matches And Sessions

`POST /api/status/match/start`

```json
{
  "external_match_id": "match-2026-05-31-001",
  "scenario": "Conflict Everon",
  "started_at": "2026-05-31 20:00:00"
}
```

`POST /api/status/match/end`

```json
{
  "external_match_id": "match-2026-05-31-001",
  "ended_at": "2026-05-31 21:12:00",
  "winning_faction": "US"
}
```

If `external_match_id` is omitted, the API closes the latest open match for that server.

`POST /api/ingest/session/start`

```json
{
  "player_reforger_id": "stable-player-id",
  "player_name": "Display Name",
  "faction": "US"
}
```

`POST /api/ingest/session/end`

```json
{
  "player_reforger_id": "stable-player-id"
}
```

## Stat Events

`POST /api/ingest/combat`

```json
{
  "player_reforger_id": "stable-player-id",
  "event_type": "kill",
  "weapon_id": "AK74",
  "weapon_name": "AK-74",
  "distance_meters": 183.4,
  "shots_fired": 4,
  "hits": 2
}
```

Supported combat `event_type` values: `kill`, `ai_kill`, `death`, `teamkill`, `assist`, `weapon_sample`.

`POST /api/ingest/medical`

```json
{
  "player_reforger_id": "stable-player-id",
  "event_type": "revive",
  "time_as_medic_seconds": 30
}
```

Supported medical values: `revive`, `bandage`, `tourniquet`.

`POST /api/ingest/vehicle`

```json
{
  "player_reforger_id": "stable-player-id",
  "event_type": "destroyed",
  "vehicle_id": "M998",
  "vehicle_name": "M998 Humvee",
  "distance_driven_meters": 1250,
  "time_in_vehicle_seconds": 300
}
```

Supported vehicle values: `kill`, `death`, `assist`, `destroyed`, `crash`, `travel`.

`POST /api/ingest/movement`

```json
{
  "player_reforger_id": "stable-player-id",
  "distance_foot_meters": 42.5,
  "distance_vehicle_meters": 0,
  "sprint_distance_meters": 12,
  "swim_distance_meters": 0,
  "time_on_foot_seconds": 10,
  "time_mounted_seconds": 0
}
```

The Reforger mod should sample every 5-10 seconds, ignore dead players, reject impossible speed changes, and separate mounted movement from foot movement.

`POST /api/ingest/objective`

```json
{
  "player_reforger_id": "stable-player-id",
  "event_type": "capture"
}
```

Supported objective values: `capture`, `defense`, `objective_completed`, `mission_participation`, `pvp_win`, `pvp_loss`.

`POST /api/ingest/smoke-test`

```json
{
  "player_reforger_id": "smoke-test-player",
  "player_name": "Smoke Test Player"
}
```

Requires server headers and writes a small session, combat, medical, vehicle, and objective sample for credential/database validation.
