const { EmbedBuilder } = require('discord.js');
const pool = require('../db/pool');
const { formatUtc } = require('../utils/time');

const FEED_EVENTS = new Set(['kill', 'ai_kill', 'teamkill']);

let tableReady = false;

function isFeedEvent(eventType) {
  return FEED_EVENTS.has(eventType);
}

async function ensureKillFeedTable() {
  if (tableReady) {
    return;
  }

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS kill_feed_events (
       id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
       server_id BIGINT UNSIGNED NOT NULL,
       player_id BIGINT UNSIGNED NOT NULL,
       event_type VARCHAR(32) NOT NULL,
       player_name VARCHAR(120) NULL,
       target_reforger_id VARCHAR(128) NULL,
       target_name VARCHAR(120) NULL,
       target_type VARCHAR(32) NULL,
       weapon_id VARCHAR(128) NULL,
       weapon_name VARCHAR(160) NULL,
       distance_meters DECIMAL(8,2) NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       posted_at TIMESTAMP NULL,
       INDEX idx_kill_feed_pending (posted_at, created_at),
       INDEX idx_kill_feed_server_created (server_id, created_at),
       CONSTRAINT fk_kill_feed_server FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
       CONSTRAINT fk_kill_feed_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
     )`
  );
  tableReady = true;
}

async function recordKillFeedEvent(connection, server, player, payload) {
  if (!isFeedEvent(payload.event_type)) {
    return;
  }

  await connection.execute(
    `INSERT INTO kill_feed_events
       (server_id, player_id, event_type, player_name, target_reforger_id, target_name, target_type, weapon_id, weapon_name, distance_meters)
     VALUES
       (:serverId, :playerId, :eventType, :playerName, :targetReforgerId, :targetName, :targetType, :weaponId, :weaponName, :distanceMeters)`,
    {
      serverId: server.id,
      playerId: player.id,
      eventType: payload.event_type,
      playerName: payload.player_name || null,
      targetReforgerId: payload.target_reforger_id || null,
      targetName: payload.target_name || null,
      targetType: payload.target_type || null,
      weaponId: payload.weapon_id || null,
      weaponName: payload.weapon_name || null,
      distanceMeters: payload.distance_meters ?? null
    }
  );
}

async function listPendingKillFeedEvents(limit = 25) {
  await ensureKillFeedTable();
  const rowLimit = Math.max(Math.min(Number.parseInt(limit, 10) || 25, 100), 1);
  const [rows] = await pool.execute(
    `SELECT e.id, e.event_type, e.player_name, e.target_name, e.target_type,
            e.weapon_name, e.weapon_id, e.distance_meters, e.created_at,
            s.server_id, s.name AS server_name, s.kill_feed_channel_id
     FROM kill_feed_events e
     JOIN servers s ON s.id = e.server_id
     WHERE e.posted_at IS NULL
       AND s.enabled = TRUE
       AND s.kill_feed_enabled = TRUE
       AND s.kill_feed_channel_id IS NOT NULL
     ORDER BY e.created_at ASC, e.id ASC
     LIMIT ${rowLimit}`
  );
  return rows;
}

async function markKillFeedEventPosted(eventId) {
  await pool.execute(
    'UPDATE kill_feed_events SET posted_at = CURRENT_TIMESTAMP WHERE id = :eventId',
    { eventId }
  );
}

function formatDistance(distanceMeters) {
  const value = Number(distanceMeters);
  if (!Number.isFinite(value) || value <= 0) {
    return 'Unknown';
  }
  return `${Math.round(value)}m`;
}

function eventTitle(event) {
  if (event.event_type === 'ai_kill') {
    return 'AI Kill';
  }
  if (event.event_type === 'teamkill') {
    return 'Teamkill';
  }
  return 'Player Kill';
}

function eventDescription(event) {
  const actor = event.player_name || 'Unknown player';
  const target = event.target_name || (event.event_type === 'ai_kill' ? 'AI' : 'Unknown target');
  const verb = event.event_type === 'teamkill' ? 'teamkilled' : 'killed';
  return `${actor} ${verb} ${target}`;
}

function buildKillFeedEmbed(event) {
  return new EmbedBuilder()
    .setTitle(eventTitle(event))
    .setDescription(eventDescription(event))
    .addFields(
      { name: 'Server', value: event.server_name || event.server_id, inline: true },
      { name: 'Weapon', value: event.weapon_name || event.weapon_id || 'Unknown', inline: true },
      { name: 'Distance', value: formatDistance(event.distance_meters), inline: true }
    )
    .setFooter({ text: `Logged ${formatUtc(event.created_at)}` });
}

module.exports = {
  ensureKillFeedTable,
  recordKillFeedEvent,
  listPendingKillFeedEvents,
  markKillFeedEventPosted,
  buildKillFeedEmbed
};
