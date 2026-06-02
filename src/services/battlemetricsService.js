const fetch = require('node-fetch');
const logger = require('../utils/logger');

const BASE_URL = 'https://api.battlemetrics.com';

async function getServerStatus(battlemetricsId) {
  if (!battlemetricsId) return null;

  const headers = {};
  if (process.env.BATTLEMETRICS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.BATTLEMETRICS_TOKEN}`;
  }

  try {
    const response = await fetch(`${BASE_URL}/servers/${battlemetricsId}`, { headers, timeout: 8000 });
    if (!response.ok) {
      logger.warn({ battlemetricsId, status: response.status }, 'BattleMetrics lookup failed');
      return null;
    }
    const body = await response.json();
    const attributes = body.data.attributes;
    return {
      id: body.data.id,
      name: attributes.name,
      status: attributes.status,
      playerCount: attributes.players,
      maxPlayers: attributes.maxPlayers,
      rank: attributes.rank,
      details: attributes.details || {}
    };
  } catch (error) {
    logger.warn({ error, battlemetricsId }, 'BattleMetrics unavailable');
    return null;
  }
}

module.exports = {
  getServerStatus
};
