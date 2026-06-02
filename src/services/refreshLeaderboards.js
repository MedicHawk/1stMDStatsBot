require('dotenv').config();

const leaderboardService = require('./leaderboardService');
const pool = require('../db/pool');
const logger = require('../utils/logger');

async function main() {
  const count = await leaderboardService.refreshDefaultLeaderboards();
  logger.info({ count }, 'Leaderboards refreshed');
}

main()
  .catch((error) => {
    logger.error({ error }, 'Failed to refresh leaderboards');
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
