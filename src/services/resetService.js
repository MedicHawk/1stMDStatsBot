const pool = require('../db/pool');

const SERVER_DATA_TABLES = [
  'server_mods',
  'player_sessions',
  'matches',
  'player_stats',
  'weapon_stats',
  'kill_feed_events',
  'vehicle_stats',
  'movement_stats',
  'objective_stats',
  'medical_stats',
  'support_stats',
  'xp_events',
  'player_xp',
  'leaderboard_cache',
  'discord_published_messages',
  'servers'
];

const ACCOUNT_DATA_TABLES = [
  'link_codes',
  'account_links',
  'players'
];

async function countRows(connection, table) {
  const [rows] = await connection.execute(`SELECT COUNT(*) AS count FROM ${table}`);
  return Number(rows[0]?.count || 0);
}

async function resetAll({ keepAccounts = false } = {}) {
  const connection = await pool.getConnection();
  const tables = keepAccounts
    ? SERVER_DATA_TABLES
    : [...SERVER_DATA_TABLES, ...ACCOUNT_DATA_TABLES];
  const deleted = {};

  try {
    await connection.beginTransaction();
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of tables) {
      deleted[table] = await countRows(connection, table);
      await connection.execute(`DELETE FROM ${table}`);
    }

    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    await connection.commit();
    return deleted;
  } catch (error) {
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  resetAll
};
