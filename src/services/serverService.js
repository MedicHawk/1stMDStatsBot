const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../db/pool');
const logger = require('../utils/logger');

function generateApiKey() {
  return crypto.randomBytes(24).toString('hex');
}

async function listServers({ enabledOnly = false } = {}) {
  const [rows] = await pool.execute(
    `SELECT s.server_id, s.name, c.slug AS category, s.battlemetrics_id, s.enabled,
            s.status_channel_id, s.leaderboard_channel_id, s.current_status,
            s.current_player_count, s.max_player_slots, s.current_map,
            s.uptime_seconds, s.battlemetrics_rank, s.last_heartbeat_at
     FROM servers s
     JOIN server_categories c ON c.id = s.category_id
     WHERE (:enabledOnly = FALSE OR s.enabled = TRUE)
     ORDER BY c.slug, s.name`,
    { enabledOnly }
  );
  return rows;
}

async function listCategories() {
  const [rows] = await pool.execute('SELECT slug, name FROM server_categories ORDER BY name');
  return rows;
}

async function addCategory(slug, name) {
  await pool.execute(
    'INSERT INTO server_categories (slug, name) VALUES (:slug, :name)',
    { slug, name }
  );
}

async function removeCategory(slug) {
  await pool.execute('DELETE FROM server_categories WHERE slug = :slug', { slug });
}

async function addServer(input) {
  const apiKeyHash = await bcrypt.hash(input.apiKey, 12);
  const [result] = await pool.execute(
    `INSERT INTO servers
       (server_id, category_id, name, battlemetrics_id, api_key_hash, enabled, status_channel_id, leaderboard_channel_id)
     SELECT :serverId, c.id, :name, :battlemetricsId, :apiKeyHash, TRUE, :statusChannelId, :leaderboardChannelId
     FROM server_categories c
     WHERE c.slug = :category`,
    {
      serverId: input.serverId,
      category: input.category,
      name: input.name,
      battlemetricsId: input.battlemetricsId || null,
      apiKeyHash,
      statusChannelId: input.statusChannelId || null,
      leaderboardChannelId: input.leaderboardChannelId || null
    }
  );
  if (result.affectedRows === 0) {
    const error = new Error('Category not found');
    error.statusCode = 400;
    throw error;
  }
}

async function addServerWithGeneratedApiKey(input) {
  const apiKey = generateApiKey();
  await addServer({ ...input, apiKey });
  return apiKey;
}

async function rotateServerApiKey(serverId) {
  const apiKey = generateApiKey();
  const apiKeyHash = await bcrypt.hash(apiKey, 12);
  const [result] = await pool.execute(
    'UPDATE servers SET api_key_hash = :apiKeyHash WHERE server_id = :serverId',
    { serverId, apiKeyHash }
  );

  if (result.affectedRows === 0) {
    const error = new Error('Server not found');
    error.statusCode = 404;
    throw error;
  }

  return apiKey;
}

async function setServerEnabled(serverId, enabled) {
  const [result] = await pool.execute('UPDATE servers SET enabled = :enabled WHERE server_id = :serverId', { serverId, enabled });
  if (result.affectedRows === 0) {
    const error = new Error('Server not found');
    error.statusCode = 404;
    throw error;
  }
}

async function removeServer(serverId) {
  const [result] = await pool.execute('DELETE FROM servers WHERE server_id = :serverId', { serverId });
  if (result.affectedRows === 0) {
    const error = new Error('Server not found');
    error.statusCode = 404;
    throw error;
  }
}

async function editServer(serverId, input) {
  const [result] = await pool.execute(
    `UPDATE servers s
     LEFT JOIN server_categories c ON c.slug = :category
     SET s.name = COALESCE(:name, s.name),
         s.battlemetrics_id = COALESCE(:battlemetricsId, s.battlemetrics_id),
         s.category_id = COALESCE(c.id, s.category_id)
     WHERE s.server_id = :serverId`,
    {
      serverId,
      name: input.name || null,
      battlemetricsId: input.battlemetricsId || null,
      category: input.category || null
    }
  );
  if (result.affectedRows === 0) {
    const error = new Error('Server not found');
    error.statusCode = 404;
    throw error;
  }
}

async function setServerCategory(serverId, category) {
  const [result] = await pool.execute(
    `UPDATE servers s
     JOIN server_categories c ON c.slug = :category
     SET s.category_id = c.id
     WHERE s.server_id = :serverId`,
    { serverId, category }
  );
  if (result.affectedRows === 0) {
    const error = new Error('Server or category not found');
    error.statusCode = 404;
    throw error;
  }
}

async function setStatusChannel(serverId, channelId) {
  const [result] = await pool.execute(
    'UPDATE servers SET status_channel_id = :channelId WHERE server_id = :serverId',
    { serverId, channelId }
  );
  if (result.affectedRows === 0) {
    const error = new Error('Server not found');
    error.statusCode = 404;
    throw error;
  }
}

async function setLeaderboardChannel(serverId, channelId) {
  const [result] = await pool.execute(
    'UPDATE servers SET leaderboard_channel_id = :channelId WHERE server_id = :serverId',
    { serverId, channelId }
  );
  if (result.affectedRows === 0) {
    const error = new Error('Server not found');
    error.statusCode = 404;
    throw error;
  }
}

async function recordHeartbeat(server, payload) {
  await pool.execute(
    `UPDATE servers
     SET current_status = 'online',
         current_player_count = COALESCE(:playerCount, current_player_count),
         max_player_slots = COALESCE(:maxSlots, max_player_slots),
         current_map = COALESCE(:mapName, current_map),
         uptime_seconds = COALESCE(:uptimeSeconds, uptime_seconds),
         last_heartbeat_at = CURRENT_TIMESTAMP
     WHERE id = :id`,
    {
      id: server.id,
      playerCount: payload.player_count ?? null,
      maxSlots: payload.max_player_slots ?? null,
      mapName: payload.map || payload.scenario || null,
      uptimeSeconds: payload.uptime_seconds ?? null
    }
  );
}

async function updatePublicStatus(serverId, status) {
  await pool.execute(
    `UPDATE servers
     SET current_status = COALESCE(:currentStatus, current_status),
         current_player_count = COALESCE(:playerCount, current_player_count),
         max_player_slots = COALESCE(:maxPlayers, max_player_slots),
         battlemetrics_rank = COALESCE(:rank, battlemetrics_rank),
         last_heartbeat_at = CURRENT_TIMESTAMP
     WHERE server_id = :serverId`,
    {
      serverId,
      currentStatus: status.status || null,
      playerCount: status.playerCount ?? null,
      maxPlayers: status.maxPlayers ?? null,
      rank: status.rank ?? null
    }
  );
}

async function replaceMods(server, mods) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('DELETE FROM server_mods WHERE server_id = :serverId', { serverId: server.id });
    for (const mod of mods) {
      await connection.execute(
        `INSERT INTO server_mods (server_id, mod_id, name, version, is_required)
         VALUES (:serverId, :modId, :name, :version, :isRequired)`,
        {
          serverId: server.id,
          modId: mod.mod_id,
          name: mod.name || mod.mod_id,
          version: mod.version || null,
          isRequired: mod.required !== false
        }
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getServerMods(serverId) {
  const [rows] = await pool.execute(
    `SELECT m.mod_id, m.name, m.version, m.is_required
     FROM server_mods m
     JOIN servers s ON s.id = m.server_id
     WHERE s.server_id = :serverId
     ORDER BY m.name`,
    { serverId }
  );
  return rows;
}

async function audit({ actorDiscordId, action, targetType, targetId, details }) {
  try {
    await pool.execute(
      `INSERT INTO audit_logs (actor_discord_id, action, target_type, target_id, details)
       VALUES (:actorDiscordId, :action, :targetType, :targetId, :details)`,
      {
        actorDiscordId: actorDiscordId || null,
        action,
        targetType: targetType || null,
        targetId: targetId || null,
        details: details ? JSON.stringify(details) : null
      }
    );
  } catch (error) {
    logger.warn({ error }, 'Failed to write audit log');
  }
}

module.exports = {
  listServers,
  listCategories,
  addCategory,
  removeCategory,
  addServer,
  addServerWithGeneratedApiKey,
  rotateServerApiKey,
  setServerEnabled,
  removeServer,
  editServer,
  setServerCategory,
  setStatusChannel,
  setLeaderboardChannel,
  recordHeartbeat,
  updatePublicStatus,
  replaceMods,
  getServerMods,
  audit
};
