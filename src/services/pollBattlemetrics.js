require('dotenv').config();

const battlemetricsService = require('./battlemetricsService');
const serverService = require('./serverService');
const pool = require('../db/pool');
const logger = require('../utils/logger');

async function main() {
  const servers = await serverService.listServers({ enabledOnly: true });
  let updated = 0;

  for (const server of servers) {
    if (!server.battlemetrics_id) continue;
    const status = await battlemetricsService.getServerStatus(server.battlemetrics_id);
    if (!status) continue;
    await serverService.updatePublicStatus(server.server_id, status);
    updated++;
  }

  logger.info({ updated }, 'BattleMetrics poll complete');
}

main()
  .catch((error) => {
    logger.error({ error }, 'BattleMetrics poll failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
