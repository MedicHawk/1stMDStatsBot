const battlemetricsService = require('../../services/battlemetricsService');
const leaderboardService = require('../../services/leaderboardService');
const serverService = require('../../services/serverService');
const logger = require('../../utils/logger');
const leaderboardEmbed = require('../embeds/leaderboardEmbed');
const serverEmbed = require('../embeds/serverEmbed');

const MIN_INTERVAL_MS = 60 * 1000;
const DEFAULT_STATUS_INTERVAL_MINUTES = 5;
const DEFAULT_LEADERBOARD_INTERVAL_MINUTES = 15;
const DEFAULT_LEADERBOARD_TYPES = ['kills', 'aikills', 'hours'];

function minutesToMs(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback * 60 * 1000;
  }
  return Math.max(Math.round(parsed * 60 * 1000), MIN_INTERVAL_MS);
}

function leaderboardTypes() {
  return (process.env.DISCORD_LEADERBOARD_TYPES || DEFAULT_LEADERBOARD_TYPES.join(','))
    .split(',')
    .map((type) => type.trim())
    .filter(Boolean);
}

async function fetchTextChannel(client, channelId) {
  if (!channelId) {
    return null;
  }

  const channel = await client.channels.fetch(channelId).catch((error) => {
    logger.warn({ channelId, error }, 'Failed to fetch configured Discord channel');
    return null;
  });

  if (!channel || !channel.isTextBased() || typeof channel.send !== 'function') {
    logger.warn({ channelId }, 'Configured Discord channel is not text-sendable');
    return null;
  }

  return channel;
}

async function publishStatus(client) {
  const servers = await serverService.listServers({ enabledOnly: true });
  for (const server of servers) {
    if (!server.status_channel_id) {
      continue;
    }

    const channel = await fetchTextChannel(client, server.status_channel_id);
    if (!channel) {
      continue;
    }

    const bm = await battlemetricsService.getServerStatus(server.battlemetrics_id);
    const merged = bm
      ? {
          ...server,
          current_status: bm.status,
          current_player_count: bm.playerCount,
          max_player_slots: bm.maxPlayers,
          battlemetrics_rank: bm.rank
        }
      : server;
    const mods = await serverService.getServerMods(server.server_id);

    await channel.send({ embeds: [serverEmbed(merged, mods)] });
    logger.info({ server_id: server.server_id, channel_id: channel.id }, 'Published server status embed');
  }
}

async function publishLeaderboards(client) {
  const servers = await serverService.listServers({ enabledOnly: true });
  const types = leaderboardTypes();

  for (const server of servers) {
    if (!server.leaderboard_channel_id) {
      continue;
    }

    const channel = await fetchTextChannel(client, server.leaderboard_channel_id);
    if (!channel) {
      continue;
    }

    const embeds = [];
    for (const type of types) {
      const result = await leaderboardService.getLeaderboard(type, {
        server: server.server_id,
        limit: 10
      });
      embeds.push(leaderboardEmbed(result));
    }

    if (embeds.length === 0) {
      continue;
    }

    await channel.send({ embeds: embeds.slice(0, 10) });
    logger.info({ server_id: server.server_id, channel_id: channel.id, types }, 'Published leaderboard embeds');
  }
}

function schedulePublisher(name, intervalMs, publisher) {
  let running = false;

  async function run() {
    if (running) {
      logger.warn({ name }, 'Skipped overlapping Discord auto-publish run');
      return;
    }

    running = true;
    try {
      await publisher();
    } catch (error) {
      logger.error({ name, error }, 'Discord auto-publish run failed');
    } finally {
      running = false;
    }
  }

  setTimeout(run, 15 * 1000);
  setInterval(run, intervalMs);
}

function startAutoPublisher(client) {
  if (process.env.DISCORD_AUTO_PUBLISH_ENABLED === 'false') {
    logger.info('Discord auto-publisher disabled');
    return;
  }

  const statusIntervalMs = minutesToMs(process.env.DISCORD_STATUS_POST_MINUTES, DEFAULT_STATUS_INTERVAL_MINUTES);
  const leaderboardIntervalMs = minutesToMs(process.env.DISCORD_LEADERBOARD_POST_MINUTES, DEFAULT_LEADERBOARD_INTERVAL_MINUTES);

  schedulePublisher('status', statusIntervalMs, () => publishStatus(client));
  schedulePublisher('leaderboards', leaderboardIntervalMs, () => publishLeaderboards(client));

  logger.info({
    status_minutes: statusIntervalMs / 60000,
    leaderboard_minutes: leaderboardIntervalMs / 60000,
    leaderboard_types: leaderboardTypes()
  }, 'Discord auto-publisher started');
}

module.exports = {
  startAutoPublisher,
  publishStatus,
  publishLeaderboards
};
