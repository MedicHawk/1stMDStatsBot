# 1stMD Stats Bot Reforger Addon

This addon provides the game-side telemetry skeleton for the Node/Express backend.

## Install In A Scenario

1. Open the scenario in Arma Reforger Workbench.
2. Select the game mode entity.
3. Add `MDST_StatsGameModeComponent`.
4. Configure:
   - API Base URL: `http://127.0.0.1:3000/` for local testing
   - Server ID: must match the backend `/server add` value
   - API Key: raw per-server key
   - Movement sample interval: 5-10 seconds is recommended
5. Save the scenario.

## What Works Now

- API heartbeat posts to `/api/status/heartbeat`
- Session starts for connected players at startup and on player connect
- Periodic movement sampling with basic dead-player and speed-spike rejection
- Bounded in-memory retry queue for posts attempted before the API is ready or when dispatch fails
- Player death and player-vs-player kill combat events
- Chat account linking with `!link CODE`
- Helper methods for link verification, combat, medical, vehicle, objective, match, and mod-list events

## Integration Points

The Reforger API surface changes across builds, so identity and event hooks are isolated:

- `MDST_PlayerIdentityService.GetStablePlayerId` currently uses `SCR_PlayerIdentityUtils.GetPlayerIdentityId`.
- Players can run `!link CODE` in chat after generating a code with Discord `/link`.
- Other addons can still call `MDST_StatsGameModeComponent.GetInstance().SendLinkCode(playerId, code)` directly.
- From other server-side scripts, call `SCR_BaseGameMode.MDST_RecordAIKill`, `MDST_RecordRevive`, `MDST_RecordObjectiveCompleted`, or the component wrapper methods directly.
- For your endless objective system, call `MDST_RecordObjectiveCompletedNear(objectivePosition, radiusMeters)` when an objective completes. Nearby players receive both mission participation and objective completion credit.
- If exact AI-kill attribution is unavailable, call `MDST_RecordAIKillsNear(position, radiusMeters, count)` to distribute cleanup-based AI kill credit among nearby players.

The backend accepts Reforger credentials as `server_id` and `api_key` query parameters; the REST client appends them automatically.
