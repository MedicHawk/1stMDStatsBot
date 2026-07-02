# 1stMD Stats Bot Reforger Addon

This addon provides the game-side telemetry skeleton for the Node/Express backend.

## Install In A Scenario

1. Open the scenario in Arma Reforger Workbench.
2. Select the game mode entity.
3. Add `MDST_StatsGameModeComponent`.
4. Configure optional defaults in Workbench. These values seed the runtime JSON file on first run:
   - API Base URL: `http://127.0.0.1:3000/` for local testing
   - Server ID: must match the backend `/server add` value
   - API Key: raw per-server key
   - Movement sample interval: 5-10 seconds is recommended
5. Save the scenario.

## Runtime Server Config

On first server start, the mod creates:

```text
$profile:MDST_StatsBot_Config.json
```

Edit that file on the game server, set `api_base_url`, `server_id`, and `api_key`, then restart the server. Once the file exists, these JSON values override the Workbench component attributes.

Example:

```json
{
  "enabled": true,
  "api_base_url": "http://207.49.100.200/",
  "server_id": "hosted-main",
  "api_key": "replace_with_server_api_key",
  "movement_sample_seconds": 10,
  "heartbeat_seconds": 30,
  "queue_flush_seconds": 15,
  "telemetry_log_seconds": 60,
  "scenario_name": "unknown",
  "max_player_slots": 64
}
```

## Runtime Mods Config

On first server start, the mod also creates:

```text
$profile:MDST_StatsBot_Mods.json
```

Edit that file on the game server to list the mods you want Discord/API users to see, then restart the server. The mod sends this list to `/api/status/mods` once during startup.

Example:

```json
{
  "mods": [
    {
      "mod_id": "1stMDStatsBot",
      "name": "1stMD Stats Bot",
      "version": "",
      "required": true
    },
    {
      "mod_id": "1stMDScoreboard",
      "name": "1stMD Scoreboard",
      "version": "",
      "required": true
    }
  ]
}
```

## What Works Now

- API heartbeat posts to `/api/status/heartbeat`
- Runtime mod-list publishing from `$profile:MDST_StatsBot_Mods.json`
- Session starts for connected players at startup and on player connect
- Periodic movement sampling with basic dead-player and speed-spike rejection
- Bounded in-memory retry queue for posts attempted before the API is ready or when dispatch fails
- Player death and player-vs-player kill combat events
- AI kill tracking through the same character life-state signal used by 1stMD Scoreboard
- Best-effort weapon/source metadata for AI kills and player kills
- AI kill attribution helpers for player ID, killer entity, instigator, and nearest-player fallback
- Chat account linking with `!link CODE`
- User-triggered stats popup with `!stats` or `/stats`
- Helper methods for link verification, combat, medical, vehicle, objective, match, and mod-list events

## Integration Points

The Reforger API surface changes across builds, so identity and event hooks are isolated:

- `MDST_PlayerIdentityService.GetStablePlayerId` currently uses `SCR_PlayerIdentityUtils.GetPlayerIdentityId`.
- Players can run `!link CODE` in chat after generating a code with Discord `/link`.
- Players can run `!stats` or `/stats` in chat to show their current stats popup; combat events no longer show it automatically.
- Other addons can still call `MDST_StatsGameModeComponent.GetInstance().SendLinkCode(playerId, code)` directly.
- From other server-side scripts, call `SCR_BaseGameMode.MDST_RecordAIKill`, `MDST_RecordAIKilledByPlayer`, `MDST_RecordAIKilledByEntity`, `MDST_RecordAIKilledByInstigator`, `MDST_RecordRevive`, `MDST_RecordObjectiveCompleted`, or the component wrapper methods directly.
- For your endless objective system, call `MDST_RecordObjectiveCompletedNear(objectivePosition, radiusMeters)` when an objective completes. Nearby players receive both mission participation and objective completion credit.
- If exact AI-kill attribution is unavailable, call `MDST_RecordAIKillNear(position, radiusMeters)` for one nearest-player AI kill, or `MDST_RecordAIKillsNear(position, radiusMeters, count)` to distribute cleanup-based AI kill credit among nearby players.

## AI Prefab Setup

The primary AI kill tracker hooks `SCR_CharacterControllerComponent.OnLifeStateChanged`, ignores player-controlled victims, reads the AI character damage manager instigator, and reports the killer player's `ai_kill`.

For fallback diagnostics, add `MDST_AIKillReporterComponent` to the AI character prefab or to the spawned AI entity template used by your scenario.

The component checks the AI entity damage state and reports one `ai_kill` when it becomes destroyed. If no precise attacker has been recorded, it credits the nearest player within the configured fallback radius.

## Weapon Tracking

Automatic AI-kill and player-kill hooks try the killer player's currently held weapon first through `WeaponUIInfo`/`UIInfo`, then the occupied vehicle, then `Instigator.GetInstigatorEntity()` source metadata. Vehicle IDs stay prefab-based, while vehicle names prefer `SCR_EditableVehicleComponent` UI info.

If the killer is in a vehicle, the mod also sends a vehicle kill event so mounted machine gun positions and vehicle kills can populate `vehicle_stats`.

For exact weapon samples from other scripts, call `MDST_RecordWeaponShots`, `MDST_RecordWeaponHits`, or `MDST_RecordWeaponAccuracySample`.

AI kill examples:

```c
SCR_BaseGameMode gameMode = SCR_BaseGameMode.Cast(GetGame().GetGameMode());
gameMode.MDST_RecordAIKilledByPlayer(playerId, aiEntity, weaponId, weaponName);
gameMode.MDST_RecordAIKilledByEntity(aiEntity, killerEntity, weaponId, weaponName);
gameMode.MDST_RecordAIKilledByInstigator(aiEntity, killerEntity, killerInstigator, weaponId, weaponName);
```

The backend accepts Reforger credentials as `server_id` and `api_key` query parameters; the REST client appends them automatically.
