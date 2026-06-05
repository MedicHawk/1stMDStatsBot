CREATE DATABASE IF NOT EXISTS arma_stats CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE arma_stats;

CREATE TABLE IF NOT EXISTS guilds (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  discord_guild_id VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS server_categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO server_categories (slug, name) VALUES
  ('pve', 'PvE'),
  ('pvp', 'PvP'),
  ('training', 'Training'),
  ('event', 'Event'),
  ('test', 'Test'),
  ('custom', 'Custom');

CREATE TABLE IF NOT EXISTS servers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  server_id VARCHAR(64) NOT NULL UNIQUE,
  guild_id BIGINT UNSIGNED NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  battlemetrics_id VARCHAR(64) NULL,
  api_key_hash VARCHAR(255) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  status_channel_id VARCHAR(32) NULL,
  leaderboard_channel_id VARCHAR(32) NULL,
  current_status ENUM('online', 'offline', 'unknown') NOT NULL DEFAULT 'unknown',
  current_player_count INT UNSIGNED NOT NULL DEFAULT 0,
  max_player_slots INT UNSIGNED NULL,
  current_map VARCHAR(160) NULL,
  uptime_seconds BIGINT UNSIGNED NULL,
  battlemetrics_rank INT UNSIGNED NULL,
  last_heartbeat_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_servers_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE SET NULL,
  CONSTRAINT fk_servers_category FOREIGN KEY (category_id) REFERENCES server_categories(id)
);

CREATE TABLE IF NOT EXISTS players (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reforger_player_id VARCHAR(128) NOT NULL UNIQUE,
  display_name VARCHAR(120) NULL,
  first_seen TIMESTAMP NULL,
  last_seen TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS account_links (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  player_id BIGINT UNSIGNED NOT NULL,
  discord_user_id VARCHAR(32) NOT NULL UNIQUE,
  linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unlinked_at TIMESTAMP NULL,
  CONSTRAINT fk_links_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS link_codes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  discord_user_id VARCHAR(32) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_link_codes_discord (discord_user_id),
  INDEX idx_link_codes_expiry (expires_at)
);

CREATE TABLE IF NOT EXISTS seasons (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  server_id BIGINT UNSIGNED NOT NULL,
  season_id BIGINT UNSIGNED NULL,
  external_match_id VARCHAR(128) NULL,
  scenario VARCHAR(160) NULL,
  winning_faction VARCHAR(120) NULL,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_matches_server FOREIGN KEY (server_id) REFERENCES servers(id),
  CONSTRAINT fk_matches_season FOREIGN KEY (season_id) REFERENCES seasons(id)
);

CREATE TABLE IF NOT EXISTS player_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  server_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  season_id BIGINT UNSIGNED NULL,
  match_id BIGINT UNSIGNED NULL,
  faction VARCHAR(120) NULL,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP NULL,
  duration_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_server FOREIGN KEY (server_id) REFERENCES servers(id),
  CONSTRAINT fk_sessions_player FOREIGN KEY (player_id) REFERENCES players(id),
  CONSTRAINT fk_sessions_season FOREIGN KEY (season_id) REFERENCES seasons(id),
  CONSTRAINT fk_sessions_match FOREIGN KEY (match_id) REFERENCES matches(id)
);

CREATE TABLE IF NOT EXISTS player_stats (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  server_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  season_id BIGINT UNSIGNED NULL,
  player_kills INT UNSIGNED NOT NULL DEFAULT 0,
  ai_kills INT UNSIGNED NOT NULL DEFAULT 0,
  deaths INT UNSIGNED NOT NULL DEFAULT 0,
  teamkills INT UNSIGNED NOT NULL DEFAULT 0,
  assists INT UNSIGNED NOT NULL DEFAULT 0,
  longest_kill_meters DECIMAL(8,2) NOT NULL DEFAULT 0,
  shots_fired INT UNSIGNED NOT NULL DEFAULT 0,
  hits INT UNSIGNED NOT NULL DEFAULT 0,
  season_scope_id BIGINT UNSIGNED AS (COALESCE(season_id, 0)) STORED,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_player_stats_scope (server_id, player_id, season_scope_id),
  CONSTRAINT fk_player_stats_server FOREIGN KEY (server_id) REFERENCES servers(id),
  CONSTRAINT fk_player_stats_player FOREIGN KEY (player_id) REFERENCES players(id),
  CONSTRAINT fk_player_stats_season FOREIGN KEY (season_id) REFERENCES seasons(id)
);

CREATE TABLE IF NOT EXISTS weapon_stats (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  server_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  season_id BIGINT UNSIGNED NULL,
  weapon_id VARCHAR(128) NOT NULL,
  weapon_name VARCHAR(160) NULL,
  kills INT UNSIGNED NOT NULL DEFAULT 0,
  shots_fired INT UNSIGNED NOT NULL DEFAULT 0,
  hits INT UNSIGNED NOT NULL DEFAULT 0,
  season_scope_id BIGINT UNSIGNED AS (COALESCE(season_id, 0)) STORED,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_weapon_scope (server_id, player_id, season_scope_id, weapon_id),
  CONSTRAINT fk_weapon_server FOREIGN KEY (server_id) REFERENCES servers(id),
  CONSTRAINT fk_weapon_player FOREIGN KEY (player_id) REFERENCES players(id),
  CONSTRAINT fk_weapon_season FOREIGN KEY (season_id) REFERENCES seasons(id)
);

CREATE TABLE IF NOT EXISTS vehicle_stats (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  server_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  season_id BIGINT UNSIGNED NULL,
  vehicle_id VARCHAR(128) NOT NULL,
  vehicle_name VARCHAR(160) NULL,
  kills INT UNSIGNED NOT NULL DEFAULT 0,
  deaths INT UNSIGNED NOT NULL DEFAULT 0,
  assists INT UNSIGNED NOT NULL DEFAULT 0,
  destroyed INT UNSIGNED NOT NULL DEFAULT 0,
  crashes INT UNSIGNED NOT NULL DEFAULT 0,
  distance_driven_meters DECIMAL(12,2) NOT NULL DEFAULT 0,
  distance_passenger_meters DECIMAL(12,2) NOT NULL DEFAULT 0,
  time_in_vehicle_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
  season_scope_id BIGINT UNSIGNED AS (COALESCE(season_id, 0)) STORED,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_vehicle_scope (server_id, player_id, season_scope_id, vehicle_id),
  CONSTRAINT fk_vehicle_server FOREIGN KEY (server_id) REFERENCES servers(id),
  CONSTRAINT fk_vehicle_player FOREIGN KEY (player_id) REFERENCES players(id),
  CONSTRAINT fk_vehicle_season FOREIGN KEY (season_id) REFERENCES seasons(id)
);

CREATE TABLE IF NOT EXISTS movement_stats (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  server_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  season_id BIGINT UNSIGNED NULL,
  distance_foot_meters DECIMAL(12,2) NOT NULL DEFAULT 0,
  distance_vehicle_meters DECIMAL(12,2) NOT NULL DEFAULT 0,
  sprint_distance_meters DECIMAL(12,2) NOT NULL DEFAULT 0,
  swim_distance_meters DECIMAL(12,2) NOT NULL DEFAULT 0,
  time_on_foot_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
  time_mounted_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
  season_scope_id BIGINT UNSIGNED AS (COALESCE(season_id, 0)) STORED,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_movement_scope (server_id, player_id, season_scope_id),
  CONSTRAINT fk_movement_server FOREIGN KEY (server_id) REFERENCES servers(id),
  CONSTRAINT fk_movement_player FOREIGN KEY (player_id) REFERENCES players(id),
  CONSTRAINT fk_movement_season FOREIGN KEY (season_id) REFERENCES seasons(id)
);

CREATE TABLE IF NOT EXISTS objective_stats (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  server_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  season_id BIGINT UNSIGNED NULL,
  captures INT UNSIGNED NOT NULL DEFAULT 0,
  defenses INT UNSIGNED NOT NULL DEFAULT 0,
  objectives_completed INT UNSIGNED NOT NULL DEFAULT 0,
  mission_participation INT UNSIGNED NOT NULL DEFAULT 0,
  pvp_wins INT UNSIGNED NOT NULL DEFAULT 0,
  pvp_losses INT UNSIGNED NOT NULL DEFAULT 0,
  season_scope_id BIGINT UNSIGNED AS (COALESCE(season_id, 0)) STORED,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_objective_scope (server_id, player_id, season_scope_id),
  CONSTRAINT fk_objective_server FOREIGN KEY (server_id) REFERENCES servers(id),
  CONSTRAINT fk_objective_player FOREIGN KEY (player_id) REFERENCES players(id),
  CONSTRAINT fk_objective_season FOREIGN KEY (season_id) REFERENCES seasons(id)
);

CREATE TABLE IF NOT EXISTS medical_stats (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  server_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED NOT NULL,
  season_id BIGINT UNSIGNED NULL,
  revives INT UNSIGNED NOT NULL DEFAULT 0,
  bandages_used INT UNSIGNED NOT NULL DEFAULT 0,
  tourniquets_used INT UNSIGNED NOT NULL DEFAULT 0,
  time_as_medic_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
  season_scope_id BIGINT UNSIGNED AS (COALESCE(season_id, 0)) STORED,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_medical_scope (server_id, player_id, season_scope_id),
  CONSTRAINT fk_medical_server FOREIGN KEY (server_id) REFERENCES servers(id),
  CONSTRAINT fk_medical_player FOREIGN KEY (player_id) REFERENCES players(id),
  CONSTRAINT fk_medical_season FOREIGN KEY (season_id) REFERENCES seasons(id)
);

CREATE TABLE IF NOT EXISTS server_mods (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  server_id BIGINT UNSIGNED NOT NULL,
  mod_id VARCHAR(128) NOT NULL,
  name VARCHAR(180) NOT NULL,
  version VARCHAR(80) NULL,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_server_mod (server_id, mod_id),
  CONSTRAINT fk_mods_server FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS discord_published_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  server_id VARCHAR(64) NOT NULL,
  message_type VARCHAR(32) NOT NULL,
  channel_id VARCHAR(32) NOT NULL,
  message_id VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_discord_published_message (server_id, message_type)
);

CREATE TABLE IF NOT EXISTS leaderboard_cache (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  leaderboard_type VARCHAR(64) NOT NULL,
  scope_type ENUM('all', 'server', 'category') NOT NULL,
  scope_id VARCHAR(64) NULL,
  season_id BIGINT UNSIGNED NULL,
  payload JSON NOT NULL,
  season_scope_id BIGINT UNSIGNED AS (COALESCE(season_id, 0)) STORED,
  refreshed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_leaderboard_cache (leaderboard_type, scope_type, scope_id, season_scope_id),
  CONSTRAINT fk_leaderboard_season FOREIGN KEY (season_id) REFERENCES seasons(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  guild_id BIGINT UNSIGNED NULL,
  actor_discord_id VARCHAR(32) NULL,
  action VARCHAR(120) NOT NULL,
  target_type VARCHAR(80) NULL,
  target_id VARCHAR(128) NULL,
  details JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE SET NULL
);
