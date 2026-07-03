require('dotenv').config();

const pool = require('./pool');

const TABLES = [
  'servers',
  'players',
  'account_links',
  'player_sessions',
  'player_stats',
  'weapon_stats',
  'vehicle_stats',
  'movement_stats',
  'objective_stats',
  'medical_events',
  'medical_stats',
  'support_events',
  'support_stats',
  'player_xp',
  'xp_events',
  'server_mods',
  'leaderboard_cache',
  'audit_logs'
];

async function main() {
  const summary = {};
  for (const table of TABLES) {
    const [[row]] = await pool.execute(`SELECT COUNT(*) AS count FROM ${table}`);
    summary[table] = row.count;
  }
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
