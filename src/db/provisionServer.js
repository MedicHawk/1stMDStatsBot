require('dotenv').config();

const crypto = require('crypto');
const serverService = require('../services/serverService');
const pool = require('./pool');

async function main() {
  const serverId = process.argv[2] || 'local-test';
  const name = process.argv[3] || 'Local Test Server';
  const category = process.argv[4] || 'test';
  const apiKey = process.argv[5] || crypto.randomBytes(24).toString('hex');

  await serverService.addServer({
    serverId,
    name,
    category,
    apiKey
  });

  console.log(JSON.stringify({ serverId, name, category, apiKey }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
