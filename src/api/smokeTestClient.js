require('dotenv').config();

const fetch = require('node-fetch');

async function main() {
  const apiUrl = process.argv[2] || process.env.PUBLIC_API_URL || 'http://localhost:3000';
  const serverId = process.argv[3] || process.env.SMOKE_SERVER_ID || 'local-test';
  const apiKey = process.argv[4] || process.env.SMOKE_API_KEY;

  if (!apiKey) {
    throw new Error('Provide API key as argv[4] or SMOKE_API_KEY');
  }

  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/ingest/smoke-test`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-server-id': serverId,
      'x-api-key': apiKey
    },
    body: JSON.stringify({
      player_reforger_id: `smoke-${Date.now()}`,
      player_name: 'Smoke Test Player'
    })
  });

  const body = await response.text();
  console.log(`${response.status} ${response.statusText}`);
  console.log(body);

  if (!response.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
