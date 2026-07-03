const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { minutesFromNow, toMysqlDateTime } = require('../utils/time');
const logger = require('../utils/logger');
const statsService = require('./statsService');

function makeCode() {
  return uuidv4().replace(/-/g, '').slice(0, 8).toUpperCase();
}

async function createLinkCode(discordUserId) {
  const code = makeCode();
  const codeHash = await bcrypt.hash(code, 12);
  const minutes = Number(process.env.LINK_CODE_MINUTES || 15);

  await pool.execute(
    `INSERT INTO link_codes (discord_user_id, code_hash, expires_at)
     VALUES (:discordUserId, :codeHash, :expiresAt)`,
    {
      discordUserId,
      codeHash,
      expiresAt: toMysqlDateTime(minutesFromNow(minutes))
    }
  );

  return { code, expiresInMinutes: minutes };
}

async function verifyInGameCode({ code, player_reforger_id, player_name }) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  const [rows] = await pool.execute(
    `SELECT * FROM link_codes
     WHERE used_at IS NULL AND expires_at > UTC_TIMESTAMP()
     ORDER BY created_at DESC
     LIMIT 25`
  );

  logger.info({
    candidate_link_codes: rows.length,
    player_reforger_id,
    player_name
  }, 'Checking active link codes');

  let matched = null;
  for (const row of rows) {
    if (await bcrypt.compare(normalizedCode, row.code_hash)) {
      matched = row;
      break;
    }
  }

  if (!matched) {
    const error = new Error('Invalid or expired link code');
    error.statusCode = 400;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO players (reforger_player_id, display_name, first_seen, last_seen)
       VALUES (:reforgerId, :displayName, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE display_name = COALESCE(:displayName, display_name), last_seen = CURRENT_TIMESTAMP`,
      { reforgerId: player_reforger_id, displayName: player_name || null }
    );
    const [[player]] = await connection.execute(
      'SELECT id FROM players WHERE reforger_player_id = :reforgerId',
      { reforgerId: player_reforger_id }
    );
    await connection.execute(
      `INSERT INTO account_links (player_id, discord_user_id)
       VALUES (:playerId, :discordUserId)
       ON DUPLICATE KEY UPDATE player_id = :playerId, unlinked_at = NULL, linked_at = CURRENT_TIMESTAMP`,
      { playerId: player.id, discordUserId: matched.discord_user_id }
    );
    await connection.execute('UPDATE link_codes SET used_at = CURRENT_TIMESTAMP WHERE id = :id', { id: matched.id });
    await connection.commit();
    return { linked: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getLinkDiagnostics(discordUserId = null) {
  const [rows] = await pool.execute(
    `SELECT
       COUNT(*) AS total_unused,
       SUM(CASE WHEN expires_at > UTC_TIMESTAMP() THEN 1 ELSE 0 END) AS active_unused,
       MAX(created_at) AS newest_created_at,
       MAX(expires_at) AS newest_expires_at,
       UTC_TIMESTAMP() AS db_utc_now
     FROM link_codes
     WHERE used_at IS NULL
       AND (:discordUserId IS NULL OR discord_user_id = :discordUserId)`,
    { discordUserId }
  );
  return rows[0] || null;
}

async function unlinkDiscordUser(discordUserId) {
  await pool.execute(
    'UPDATE account_links SET unlinked_at = CURRENT_TIMESTAMP WHERE discord_user_id = :discordUserId',
    { discordUserId }
  );
}

async function getProfileByDiscordId(discordUserId) {
  await statsService.ensureSupportSchema();
  const [rows] = await pool.execute(
    `SELECT p.*,
            COALESCE(ps.player_kills, 0) AS player_kills,
            COALESCE(ps.ai_kills, 0) AS ai_kills,
            COALESCE(ps.deaths, 0) AS deaths,
            COALESCE(ps.teamkills, 0) AS teamkills,
            COALESCE(ps.assists, 0) AS assists,
            COALESCE(ms.revives, 0) AS revives,
            COALESCE(ms.bandages_used, 0) AS bandages_used,
            COALESCE(ms.tourniquets_used, 0) AS tourniquets_used,
            COALESCE(ms.heals, 0) AS heals,
            COALESCE(ms.treatment_amount, 0) AS treatment_amount,
            COALESCE(ss.resupplies, 0) AS resupplies,
            COALESCE(ss.supply_deliveries, 0) AS supply_deliveries,
            COALESCE(ss.repairs, 0) AS support_repairs,
            COALESCE(ss.builds, 0) AS builds,
            COALESCE(ss.transports, 0) AS transports,
            COALESCE(ss.teamwork_actions, 0) AS teamwork_actions,
            COALESCE(ss.support_amount, 0) AS support_amount,
            COALESCE(vs.repairs, 0) AS vehicle_repairs,
            COALESCE(px.xp, 0) AS xp,
            COALESCE(mv.distance_foot_meters, 0) AS distance_foot_meters,
            COALESCE(mv.distance_vehicle_meters, 0) AS distance_vehicle_meters,
            COALESCE(sess.value_seconds, 0) AS playtime_seconds
     FROM account_links al
     JOIN players p ON p.id = al.player_id
     LEFT JOIN (
       SELECT player_id,
              SUM(player_kills) AS player_kills,
              SUM(ai_kills) AS ai_kills,
              SUM(deaths) AS deaths,
              SUM(teamkills) AS teamkills,
              SUM(assists) AS assists
       FROM player_stats
       GROUP BY player_id
     ) ps ON ps.player_id = p.id
     LEFT JOIN (
       SELECT player_id,
              SUM(revives) AS revives,
              SUM(bandages_used) AS bandages_used,
              SUM(tourniquets_used) AS tourniquets_used,
              SUM(heals) AS heals,
              SUM(treatment_amount) AS treatment_amount
       FROM medical_stats
       GROUP BY player_id
     ) ms ON ms.player_id = p.id
     LEFT JOIN (
       SELECT player_id,
              SUM(resupplies) AS resupplies,
              SUM(supply_deliveries) AS supply_deliveries,
              SUM(repairs) AS repairs,
              SUM(builds) AS builds,
              SUM(transports) AS transports,
              SUM(teamwork_actions) AS teamwork_actions,
              SUM(support_amount) AS support_amount
       FROM support_stats
       GROUP BY player_id
     ) ss ON ss.player_id = p.id
     LEFT JOIN (
       SELECT player_id, SUM(repairs) AS repairs
       FROM vehicle_stats
       GROUP BY player_id
     ) vs ON vs.player_id = p.id
     LEFT JOIN (
       SELECT player_id, SUM(xp) AS xp
       FROM player_xp
       GROUP BY player_id
     ) px ON px.player_id = p.id
     LEFT JOIN (
       SELECT player_id,
              SUM(distance_foot_meters) AS distance_foot_meters,
              SUM(distance_vehicle_meters) AS distance_vehicle_meters
       FROM movement_stats
       GROUP BY player_id
     ) mv ON mv.player_id = p.id
     LEFT JOIN (
       SELECT player_id,
              SUM(
                CASE
                  WHEN ended_at IS NULL THEN TIMESTAMPDIFF(SECOND, started_at, CURRENT_TIMESTAMP)
                  ELSE duration_seconds
                END
              ) AS value_seconds
       FROM player_sessions
       GROUP BY player_id
     ) sess ON sess.player_id = p.id
     WHERE al.discord_user_id = :discordUserId AND al.unlinked_at IS NULL
     LIMIT 1`,
    { discordUserId }
  );
  return rows[0] || null;
}

module.exports = {
  createLinkCode,
  verifyInGameCode,
  getLinkDiagnostics,
  unlinkDiscordUser,
  getProfileByDiscordId
};
