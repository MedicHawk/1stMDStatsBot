const battlemetricsService = require('../../services/battlemetricsService');
const killFeedService = require('../../services/killFeedService');
const leaderboardService = require('../../services/leaderboardService');
const serverService = require('../../services/serverService');
const logger = require('../../utils/logger');
const leaderboardEmbed = require('../embeds/leaderboardEmbed');
const serverEmbed = require('../embeds/serverEmbed');

const MIN_INTERVAL_MS = 60 * 1000;
const DEFAULT_STATUS_INTERVAL_MINUTES = 5;
const DEFAULT_LEADERBOARD_INTERVAL_MINUTES = 15;
const DEFAULT_KILL_FEED_INTERVAL_SECONDS = 10;
const DEFAULT_LEADERBOARD_TYPES = ['kills', 'aikills', 'hours'];
const DEFAULT_STATUS_OFFLINE_AFTER_MINUTES = 5;
const ONLINE_INDICATOR = '\u{1F7E2}';
const OFFLINE_INDICATOR = '\u{1F534}';

function minutesToMs(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback * 60 * 1000;
  }
  return Math.max(Math.round(parsed * 60 * 1000), MIN_INTERVAL_MS);
}

function secondsToMs(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback * 1000;
  }
  return Math.max(Math.round(parsed * 1000), 5000);
}

function leaderboardTypes() {
  return (process.env.DISCORD_LEADERBOARD_TYPES || DEFAULT_LEADERBOARD_TYPES.join(','))
    .split(',')
    .map((type) => type.trim())
    .filter(Boolean);
}

function isEnabled(value) {
  return value !== 'false';
}

function isFreshHeartbeat(server) {
  if (!server.last_heartbeat_at) {
    return false;
  }

  const lastHeartbeat = new Date(server.last_heartbeat_at).getTime();
  if (!Number.isFinite(lastHeartbeat)) {
    return false;
  }

  const offlineAfterMs = minutesToMs(
    process.env.DISCORD_STATUS_OFFLINE_AFTER_MINUTES,
    DEFAULT_STATUS_OFFLINE_AFTER_MINUTES
  );
  return Date.now() - lastHeartbeat <= offlineAfterMs;
}

function normalizeStatus(server) {
  const rawStatus = String(server.current_status || 'unknown').toLowerCase();
  if (rawStatus === 'online' && isFreshHeartbeat(server)) {
    return 'online';
  }

  return 'offline';
}

function sanitizeChannelSegment(value) {
  return String(value || 'server')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'server';
}

function buildStatusChannelName(server) {
  const status = normalizeStatus(server);
  const indicator = status === 'online' ? ONLINE_INDICATOR : OFFLINE_INDICATOR;
  const players = status === 'online' ? Number(server.current_player_count || 0) : 0;
  const maxSlots = server.max_player_slots ? Number(server.max_player_slots) : null;
  const serverName = sanitizeChannelSegment(server.name || server.server_id);
  const playerPart = maxSlots ? `${players}-${maxSlots}` : `${players}`;

  return `${indicator}-${serverName}-${playerPart}`.slice(0, 100);
}

function buildPresenceText(servers) {
  const onlineServers = servers.filter((server) => normalizeStatus(server) === 'online');
  const playerCount = onlineServers.reduce((total, server) => total + Number(server.current_player_count || 0), 0);
  const maxSlots = onlineServers.reduce((total, server) => total + Number(server.max_player_slots || 0), 0);

  if (servers.length === 0) {
    return `${OFFLINE_INDICATOR} no servers configured`;
  }

  if (onlineServers.length === 0) {
    return `${OFFLINE_INDICATOR} ${servers.length} servers offline`;
  }

  const playerPart = maxSlots > 0 ? `${playerCount}/${maxSlots}` : `${playerCount}`;
  return `${ONLINE_INDICATOR} ${onlineServers.length}/${servers.length} online | ${playerPart} players`;
}

async function updateBotPresence(client, servers) {
  if (!isEnabled(process.env.DISCORD_STATUS_PRESENCE_ENABLED)) {
    return;
  }

  if (!client.user) {
    return;
  }

  await client.user.setPresence({
    status: servers.some((server) => normalizeStatus(server) === 'online') ? 'online' : 'idle',
    activities: [
      {
        name: buildPresenceText(servers),
        type: 4
      }
    ]
  });
}

async function updateStatusChannelName(channel, server) {
  if (!isEnabled(process.env.DISCORD_STATUS_RENAME_ENABLED)) {
    return;
  }

  if (!channel || typeof channel.setName !== 'function') {
    return;
  }

  const nextName = buildStatusChannelName(server);
  if (channel.name === nextName) {
    return;
  }

  await channel.setName(nextName, `1stMD status update for ${server.server_id}`).catch((error) => {
    logger.warn({
      server_id: server.server_id,
      channel_id: channel.id,
      current_name: channel.name,
      next_name: nextName,
      error
    }, 'Failed to update status channel name');
  });
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

async function upsertPublishedMessage(channel, server, messageType, payload) {
  const existing = await serverService.getPublishedMessage(server.server_id, messageType);

  if (existing && existing.channel_id === channel.id) {
    const message = await channel.messages.fetch(existing.message_id).catch((error) => {
      logger.warn({
        server_id: server.server_id,
        channel_id: channel.id,
        message_id: existing.message_id,
        message_type: messageType,
        error
      }, 'Failed to fetch previous published Discord message');
      return null;
    });

    if (message) {
      await message.edit(payload);
      logger.info({
        server_id: server.server_id,
        channel_id: channel.id,
        message_id: message.id,
        message_type: messageType
      }, 'Updated published Discord message');
      return message;
    }
  }

  const message = await channel.send(payload);
  await serverService.setPublishedMessage(server.server_id, messageType, channel.id, message.id);
  logger.info({
    server_id: server.server_id,
    channel_id: channel.id,
    message_id: message.id,
    message_type: messageType
  }, 'Created published Discord message');
  return message;
}

async function withBattlemetricsStatus(server) {
  const bm = await battlemetricsService.getServerStatus(server.battlemetrics_id);
  if (!bm) {
    return server;
  }

  return {
    ...server,
    current_status: bm.status,
    current_player_count: bm.playerCount,
    max_player_slots: bm.maxPlayers,
    battlemetrics_rank: bm.rank
  };
}

async function publishStatus(client) {
  const servers = await serverService.listServers({ enabledOnly: true });
  const presenceServers = [];

  for (const server of servers) {
    const merged = await withBattlemetricsStatus(server);
    presenceServers.push(merged);

    if (!server.status_channel_id) {
      continue;
    }

    const channel = await fetchTextChannel(client, server.status_channel_id);
    if (!channel) {
      continue;
    }

    await updateStatusChannelName(channel, merged);
    await upsertPublishedMessage(channel, server, 'status', { embeds: [serverEmbed(merged)] });
  }

  await updateBotPresence(client, presenceServers);
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

    await upsertPublishedMessage(channel, server, 'leaderboard', { embeds: embeds.slice(0, 10) });
    logger.info({ server_id: server.server_id, channel_id: channel.id, types }, 'Published leaderboard embeds');
  }
}

async function publishKillFeed(client) {
  if (!isEnabled(process.env.DISCORD_KILL_FEED_ENABLED)) {
    return;
  }

  await serverService.ensureServerFeatureColumns();
  const events = await killFeedService.listPendingKillFeedEvents(25);
  for (const event of events) {
    const channel = await fetchTextChannel(client, event.kill_feed_channel_id);
    if (!channel) {
      continue;
    }

    const message = await channel.send({ embeds: [killFeedService.buildKillFeedEmbed(event)] }).catch((error) => {
      logger.warn({
        event_id: event.id,
        server_id: event.server_id,
        channel_id: event.kill_feed_channel_id,
        error
      }, 'Failed to send kill feed event');
      return null;
    });

    if (!message) {
      continue;
    }

    await killFeedService.markKillFeedEventPosted(event.id);
    logger.info({
      event_id: event.id,
      server_id: event.server_id,
      channel_id: event.kill_feed_channel_id,
      message_id: message.id
    }, 'Published kill feed event');
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
  if (!isEnabled(process.env.DISCORD_AUTO_PUBLISH_ENABLED)) {
    logger.info('Discord auto-publisher disabled');
    return;
  }

  const statusIntervalMs = minutesToMs(process.env.DISCORD_STATUS_POST_MINUTES, DEFAULT_STATUS_INTERVAL_MINUTES);
  const leaderboardIntervalMs = minutesToMs(process.env.DISCORD_LEADERBOARD_POST_MINUTES, DEFAULT_LEADERBOARD_INTERVAL_MINUTES);
  const killFeedIntervalMs = secondsToMs(process.env.DISCORD_KILL_FEED_POST_SECONDS, DEFAULT_KILL_FEED_INTERVAL_SECONDS);

  schedulePublisher('status', statusIntervalMs, () => publishStatus(client));
  schedulePublisher('leaderboards', leaderboardIntervalMs, () => publishLeaderboards(client));
  schedulePublisher('kill-feed', killFeedIntervalMs, () => publishKillFeed(client));

  logger.info({
    status_minutes: statusIntervalMs / 60000,
    leaderboard_minutes: leaderboardIntervalMs / 60000,
    kill_feed_seconds: killFeedIntervalMs / 1000,
    leaderboard_types: leaderboardTypes(),
    status_rename_enabled: isEnabled(process.env.DISCORD_STATUS_RENAME_ENABLED),
    status_presence_enabled: isEnabled(process.env.DISCORD_STATUS_PRESENCE_ENABLED),
    kill_feed_enabled: isEnabled(process.env.DISCORD_KILL_FEED_ENABLED)
  }, 'Discord auto-publisher started');
}

module.exports = {
  startAutoPublisher,
  publishStatus,
  publishLeaderboards,
  publishKillFeed,
  buildStatusChannelName,
  buildPresenceText,
  upsertPublishedMessage
};
