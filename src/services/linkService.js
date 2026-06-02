const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { minutesFromNow, toMysqlDateTime } = require('../utils/time');

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
  const [rows] = await pool.execute(
    `SELECT * FROM link_codes
     WHERE used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
     ORDER BY created_at DESC
     LIMIT 25`
  );

  let matched = null;
  for (const row of rows) {
    if (await bcrypt.compare(code, row.code_hash)) {
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

async function unlinkDiscordUser(discordUserId) {
  await pool.execute(
    'UPDATE account_links SET unlinked_at = CURRENT_TIMESTAMP WHERE discord_user_id = :discordUserId',
    { discordUserId }
  );
}

async function getProfileByDiscordId(discordUserId) {
  const [rows] = await pool.execute(
    `SELECT p.*, ps.player_kills, ps.ai_kills, ps.deaths, ms.revives,
            mv.distance_foot_meters, mv.distance_vehicle_meters
     FROM account_links al
     JOIN players p ON p.id = al.player_id
     LEFT JOIN player_stats ps ON ps.player_id = p.id AND ps.season_id IS NULL
     LEFT JOIN medical_stats ms ON ms.player_id = p.id AND ms.season_id IS NULL
     LEFT JOIN movement_stats mv ON mv.player_id = p.id AND mv.season_id IS NULL
     WHERE al.discord_user_id = :discordUserId AND al.unlinked_at IS NULL
     LIMIT 1`,
    { discordUserId }
  );
  return rows[0] || null;
}

module.exports = {
  createLinkCode,
  verifyInGameCode,
  unlinkDiscordUser,
  getProfileByDiscordId
};
