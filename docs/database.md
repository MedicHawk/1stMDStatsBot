# Database Notes

Run `src/db/schema.sql` against MySQL to create the local schema.

The schema uses flexible server categories instead of hardcoded PvE/PvP behavior. Default categories are inserted, but admins can add more with `/category add`.

Every stat table includes `server_id`, `player_id`, `season_id`, and an update timestamp. Player identity uses `players.reforger_player_id`; display names are not unique and should never be used as identifiers.

API keys are bcrypt hashed in `servers.api_key_hash`. The raw key is only accepted from Discord admin setup or an external provisioning process, then discarded.

Leaderboard reads should prefer `leaderboard_cache` once the scheduled refresh job is implemented. The current service includes live fallback queries for early development.
