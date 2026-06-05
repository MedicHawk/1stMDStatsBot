const pool = require('../db/pool');
const { parsePositiveInt } = require('../utils/validators');

const SQL_BY_TYPE = {
  kills: 'ps.player_kills',
  aikills: 'ps.ai_kills',
  deaths: 'ps.deaths',
  hours: 'SUM(sess.duration_seconds)',
  revives: 'ms.revives',
  distance: 'mv.distance_foot_meters + mv.distance_vehicle_meters'
};

async function getLeaderboard(type, filters = {}) {
  const cache = await getCachedLeaderboard(type, filters);
  if (cache) return cache;
  return buildLeaderboard(type, filters);
}

async function refreshLeaderboard(type, filters = {}) {
  const result = await buildLeaderboard(type, filters);
  const scopeType = filters.server ? 'server' : filters.category ? 'category' : 'all';
  const scopeId = filters.server || filters.category || 'all';
  const seasonId = filters.season_id || null;

  await pool.execute(
    `INSERT INTO leaderboard_cache (leaderboard_type, scope_type, scope_id, season_id, payload, refreshed_at)
     VALUES (:type, :scopeType, :scopeId, :seasonId, :payload, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE payload = VALUES(payload), refreshed_at = CURRENT_TIMESTAMP`,
    {
      type,
      scopeType,
      scopeId,
      seasonId,
      payload: JSON.stringify(result)
    }
  );
  return result;
}

async function refreshDefaultLeaderboards() {
  const types = Object.keys(SQL_BY_TYPE);
  const [categories] = await pool.execute('SELECT slug FROM server_categories');
  const [servers] = await pool.execute('SELECT server_id FROM servers WHERE enabled = TRUE');
  const refreshed = [];

  for (const type of types) {
    refreshed.push(await refreshLeaderboard(type, {}));
    for (const category of categories) {
      refreshed.push(await refreshLeaderboard(type, { category: category.slug }));
    }
    for (const server of servers) {
      refreshed.push(await refreshLeaderboard(type, { server: server.server_id }));
    }
  }

  return refreshed.length;
}

async function getCachedLeaderboard(type, filters = {}) {
  const scopeType = filters.server ? 'server' : filters.category ? 'category' : 'all';
  const scopeId = filters.server || filters.category || 'all';
  const seasonId = filters.season_id || null;
  const [rows] = await pool.execute(
    `SELECT payload, refreshed_at
     FROM leaderboard_cache
     WHERE leaderboard_type = :type
       AND scope_type = :scopeType
       AND (scope_id <=> :scopeId)
       AND (season_id <=> :seasonId)
     LIMIT 1`,
    { type, scopeType, scopeId, seasonId }
  );
  if (!rows[0]) return null;
  const payload = typeof rows[0].payload === 'string' ? JSON.parse(rows[0].payload) : rows[0].payload;
  return { ...payload, refreshed_at: rows[0].refreshed_at, cached: true };
}

async function buildLeaderboard(type, filters = {}) {
  const limit = parsePositiveInt(filters.limit, 10);
  const queryFilters = {
    server: filters.server || null,
    category: filters.category || null,
    seasonId: filters.season_id || null
  };

  if (type === 'hours') {
    const [rows] = await pool.execute(
      `SELECT p.display_name, p.reforger_player_id, SUM(sess.duration_seconds) AS value_seconds
       FROM player_sessions sess
       JOIN players p ON p.id = sess.player_id
       JOIN servers s ON s.id = sess.server_id
       JOIN server_categories c ON c.id = s.category_id
       WHERE (:server IS NULL OR s.server_id = :server)
         AND (:category IS NULL OR c.slug = :category)
         AND (:seasonId IS NULL OR sess.season_id = :seasonId)
       GROUP BY p.id, p.display_name, p.reforger_player_id
       ORDER BY value_seconds DESC
       LIMIT ${limit}`,
      queryFilters
    );
    return { type, filters, rows, cached: false };
  }

  if (type === 'revives') {
    const [rows] = await pool.execute(
      `SELECT p.display_name, p.reforger_player_id, SUM(ms.revives) AS value
       FROM medical_stats ms
       JOIN players p ON p.id = ms.player_id
       JOIN servers s ON s.id = ms.server_id
       JOIN server_categories c ON c.id = s.category_id
       WHERE (:server IS NULL OR s.server_id = :server)
         AND (:category IS NULL OR c.slug = :category)
         AND (:seasonId IS NULL OR ms.season_id = :seasonId)
       GROUP BY p.id, p.display_name, p.reforger_player_id
       ORDER BY value DESC
       LIMIT ${limit}`,
      queryFilters
    );
    return { type, filters, rows, cached: false };
  }

  if (type === 'distance') {
    const [rows] = await pool.execute(
      `SELECT p.display_name, p.reforger_player_id, SUM(mv.distance_foot_meters + mv.distance_vehicle_meters) AS value
       FROM movement_stats mv
       JOIN players p ON p.id = mv.player_id
       JOIN servers s ON s.id = mv.server_id
       JOIN server_categories c ON c.id = s.category_id
       WHERE (:server IS NULL OR s.server_id = :server)
         AND (:category IS NULL OR c.slug = :category)
         AND (:seasonId IS NULL OR mv.season_id = :seasonId)
       GROUP BY p.id, p.display_name, p.reforger_player_id
       ORDER BY value DESC
       LIMIT ${limit}`,
      queryFilters
    );
    return { type, filters, rows, cached: false };
  }

  const statColumn = SQL_BY_TYPE[type] || SQL_BY_TYPE.kills;
  const [rows] = await pool.execute(
    `SELECT p.display_name, p.reforger_player_id, SUM(${statColumn}) AS value
     FROM player_stats ps
     JOIN players p ON p.id = ps.player_id
     JOIN servers s ON s.id = ps.server_id
     JOIN server_categories c ON c.id = s.category_id
     WHERE (:server IS NULL OR s.server_id = :server)
       AND (:category IS NULL OR c.slug = :category)
       AND (:seasonId IS NULL OR ps.season_id = :seasonId)
     GROUP BY p.id, p.display_name, p.reforger_player_id
     ORDER BY value DESC
     LIMIT ${limit}`,
    queryFilters
  );
  return { type, filters, rows, cached: false };
}

async function getTopWeapons(filters = {}) {
  const limit = parsePositiveInt(filters.limit, 10);
  const [rows] = await pool.execute(
    `SELECT ws.weapon_id, COALESCE(ws.weapon_name, ws.weapon_id) AS weapon_name,
            SUM(ws.kills) AS kills,
            SUM(ws.shots_fired) AS shots_fired,
            SUM(ws.hits) AS hits
     FROM weapon_stats ws
     JOIN servers s ON s.id = ws.server_id
     JOIN server_categories c ON c.id = s.category_id
     WHERE (:server IS NULL OR s.server_id = :server)
       AND (:category IS NULL OR c.slug = :category)
       AND (:seasonId IS NULL OR ws.season_id = :seasonId)
     GROUP BY ws.weapon_id, ws.weapon_name
     ORDER BY kills DESC, hits DESC
     LIMIT ${limit}`,
    {
      server: filters.server || null,
      category: filters.category || null,
      seasonId: filters.season_id || null
    }
  );
  return { type: 'weapons', filters, rows, cached: false };
}

async function getTopVehicles(filters = {}) {
  const limit = parsePositiveInt(filters.limit, 10);
  const [rows] = await pool.execute(
    `SELECT vs.vehicle_id, COALESCE(vs.vehicle_name, vs.vehicle_id) AS vehicle_name,
            SUM(vs.kills) AS kills,
            SUM(vs.destroyed) AS destroyed,
            SUM(vs.distance_driven_meters) AS distance_driven_meters,
            SUM(vs.time_in_vehicle_seconds) AS time_in_vehicle_seconds
     FROM vehicle_stats vs
     JOIN servers s ON s.id = vs.server_id
     JOIN server_categories c ON c.id = s.category_id
     WHERE (:server IS NULL OR s.server_id = :server)
       AND (:category IS NULL OR c.slug = :category)
       AND (:seasonId IS NULL OR vs.season_id = :seasonId)
     GROUP BY vs.vehicle_id, vs.vehicle_name
     ORDER BY kills DESC, destroyed DESC, distance_driven_meters DESC
     LIMIT ${limit}`,
    {
      server: filters.server || null,
      category: filters.category || null,
      seasonId: filters.season_id || null
    }
  );
  return { type: 'vehicles', filters, rows, cached: false };
}

module.exports = {
  getLeaderboard,
  refreshLeaderboard,
  refreshDefaultLeaderboards,
  getTopWeapons,
  getTopVehicles
};
