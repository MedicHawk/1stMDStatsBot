const serverService = require('../../services/serverService');

async function findServer(input, { enabledOnly = true } = {}) {
  const servers = await serverService.listServers({ enabledOnly });
  if (!input) return servers[0] || null;

  const needle = input.toLowerCase();
  return servers.find((server) => server.server_id.toLowerCase() === needle)
    || servers.find((server) => server.name.toLowerCase() === needle)
    || servers.find((server) => server.name.toLowerCase().includes(needle))
    || null;
}

module.exports = {
  findServer
};
