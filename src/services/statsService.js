const pool = require('../db/pool');
const killFeedService = require('./killFeedService');

const ADJUSTABLE_PLAYER_STATS = new Set([
  'player_kills',
  'ai_kills',
  'deaths',
  'teamkills',
  'assists',
  'shots_fired',
  'hits'
]);

const XP_VALUES = {
  combat: {
    kill: 100,
    ai_kill: 25,
    assist: 50,
    teamkill: -100
  },
  medical: {
    revive: 75,
    bandage: 15,
    tourniquet: 20,
    heal: 25
  },
  vehicle: {
    kill: 75,
    assist: 35,
    destroyed: 50,
    repair: 50,
    travel: 5
  },
  objective: {
    capture: 150,
    defense: 100,
    objective_completed: 200,
    mission_participation: 25,
    pvp_win: 100,
    pvp_loss: 25
  },
  support: {
    resupply: 25,
    ammo_resupply: 25,
    supply_delivery: 75,
    repair: 50,
    vehicle_repair: 50,
    build: 40,
    fortification: 40,
    transport: 35,
    teamwork: 30,
    squad_support: 30,
    spot: 20,
    deploy_spawn: 50
  }
};

let supportSchemaReady = false;

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseNonNegativeInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function ensurePlayer(connection, payload) {
  await connection.execute(
    `INSERT INTO players (reforger_player_id, display_name, first_seen, last_seen)
     VALUES (:reforgerId, :displayName, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE display_name = COALESCE(:displayName, display_name), last_seen = CURRENT_TIMESTAMP`,
    {
      reforgerId: payload.player_reforger_id,
      displayName: payload.player_name || null
    }
  );
  const [[player]] = await connection.execute(
    'SELECT id FROM players WHERE reforger_player_id = :reforgerId',
    { reforgerId: payload.player_reforger_id }
  );
  return player;
}

async function withPlayer(server, season, payload, callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const player = await ensurePlayer(connection, payload);
    await callback(connection, player, season ? season.id : null);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function ensureColumn(tableName, columnName, definition) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = :tableName
       AND COLUMN_NAME = :columnName`,
    { tableName, columnName }
  );

  if (Number(rows[0].count) === 0) {
    await pool.execute(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
  }
}

async function ensureSupportSchema() {
  if (supportSchemaReady) {
    return;
  }

  await ensureColumn('medical_stats', 'heals', 'heals INT UNSIGNED NOT NULL DEFAULT 0 AFTER tourniquets_used');
  await ensureColumn('medical_stats', 'treatment_amount', 'treatment_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER heals');
  await ensureColumn('vehicle_stats', 'repairs', 'repairs INT UNSIGNED NOT NULL DEFAULT 0 AFTER crashes');
  await ensureColumn('player_sessions', 'rank_name', 'rank_name VARCHAR(80) NULL AFTER faction');

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS support_stats (
       id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
       server_id BIGINT UNSIGNED NOT NULL,
       player_id BIGINT UNSIGNED NOT NULL,
       season_id BIGINT UNSIGNED NULL,
       resupplies INT UNSIGNED NOT NULL DEFAULT 0,
       supply_deliveries INT UNSIGNED NOT NULL DEFAULT 0,
       repairs INT UNSIGNED NOT NULL DEFAULT 0,
       builds INT UNSIGNED NOT NULL DEFAULT 0,
       transports INT UNSIGNED NOT NULL DEFAULT 0,
       teamwork_actions INT UNSIGNED NOT NULL DEFAULT 0,
       season_scope_id BIGINT UNSIGNED AS (COALESCE(season_id, 0)) STORED,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       UNIQUE KEY uniq_support_scope (server_id, player_id, season_scope_id),
       CONSTRAINT fk_support_server FOREIGN KEY (server_id) REFERENCES servers(id),
       CONSTRAINT fk_support_player FOREIGN KEY (player_id) REFERENCES players(id),
       CONSTRAINT fk_support_season FOREIGN KEY (season_id) REFERENCES seasons(id)
     )`
  );

  await ensureColumn('support_stats', 'support_amount', 'support_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER teamwork_actions');

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS medical_events (
       id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
       server_id BIGINT UNSIGNED NOT NULL,
       player_id BIGINT UNSIGNED NOT NULL,
       season_id BIGINT UNSIGNED NULL,
       event_type VARCHAR(32) NOT NULL,
       player_name VARCHAR(120) NULL,
       target_reforger_id VARCHAR(128) NULL,
       target_name VARCHAR(120) NULL,
       target_type VARCHAR(32) NULL,
       amount DECIMAL(12,2) NULL,
       time_as_medic_seconds INT UNSIGNED NOT NULL DEFAULT 0,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       INDEX idx_medical_events_player (player_id, created_at),
       INDEX idx_medical_events_server_created (server_id, created_at),
       CONSTRAINT fk_medical_events_server FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
       CONSTRAINT fk_medical_events_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
       CONSTRAINT fk_medical_events_season FOREIGN KEY (season_id) REFERENCES seasons(id)
     )`
  );
  await ensureColumn('medical_events', 'posted_at', 'posted_at TIMESTAMP NULL AFTER created_at');

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS support_events (
       id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
       server_id BIGINT UNSIGNED NOT NULL,
       player_id BIGINT UNSIGNED NOT NULL,
       season_id BIGINT UNSIGNED NULL,
       event_type VARCHAR(64) NOT NULL,
       player_name VARCHAR(120) NULL,
       target_id VARCHAR(128) NULL,
       target_name VARCHAR(120) NULL,
       target_type VARCHAR(32) NULL,
       amount DECIMAL(12,2) NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       INDEX idx_support_events_player (player_id, created_at),
       INDEX idx_support_events_server_created (server_id, created_at),
       CONSTRAINT fk_support_events_server FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
       CONSTRAINT fk_support_events_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
       CONSTRAINT fk_support_events_season FOREIGN KEY (season_id) REFERENCES seasons(id)
     )`
  );
  await ensureColumn('support_events', 'posted_at', 'posted_at TIMESTAMP NULL AFTER created_at');

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS player_xp (
       id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
       server_id BIGINT UNSIGNED NOT NULL,
       player_id BIGINT UNSIGNED NOT NULL,
       season_id BIGINT UNSIGNED NULL,
       xp INT NOT NULL DEFAULT 0,
       season_scope_id BIGINT UNSIGNED AS (COALESCE(season_id, 0)) STORED,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
       UNIQUE KEY uniq_player_xp_scope (server_id, player_id, season_scope_id),
       CONSTRAINT fk_player_xp_server FOREIGN KEY (server_id) REFERENCES servers(id),
       CONSTRAINT fk_player_xp_player FOREIGN KEY (player_id) REFERENCES players(id),
       CONSTRAINT fk_player_xp_season FOREIGN KEY (season_id) REFERENCES seasons(id)
     )`
  );

  await pool.execute(
    `CREATE TABLE IF NOT EXISTS xp_events (
       id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
       server_id BIGINT UNSIGNED NOT NULL,
       player_id BIGINT UNSIGNED NOT NULL,
       season_id BIGINT UNSIGNED NULL,
       source_type VARCHAR(32) NOT NULL,
       source_event VARCHAR(64) NOT NULL,
       xp_delta INT NOT NULL,
       details JSON NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       INDEX idx_xp_events_player (player_id, created_at),
       CONSTRAINT fk_xp_events_server FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
       CONSTRAINT fk_xp_events_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
       CONSTRAINT fk_xp_events_season FOREIGN KEY (season_id) REFERENCES seasons(id)
     )`
  );

  supportSchemaReady = true;
}

function xpFor(sourceType, eventType) {
  return XP_VALUES[sourceType]?.[eventType] || 0;
}

async function awardXp(connection, server, player, seasonId, sourceType, eventType, payload = {}) {
  const xpDelta = xpFor(sourceType, eventType);
  if (!xpDelta) {
    return;
  }

  await connection.execute(
    `INSERT INTO player_xp (server_id, player_id, season_id, xp)
     VALUES (:serverId, :playerId, :seasonId, :xpDelta)
     ON DUPLICATE KEY UPDATE xp = GREATEST(xp + :xpDelta, 0)`,
    { serverId: server.id, playerId: player.id, seasonId, xpDelta }
  );

  await connection.execute(
    `INSERT INTO xp_events (server_id, player_id, season_id, source_type, source_event, xp_delta, details)
     VALUES (:serverId, :playerId, :seasonId, :sourceType, :sourceEvent, :xpDelta, :details)`,
    {
      serverId: server.id,
      playerId: player.id,
      seasonId,
      sourceType,
      sourceEvent: eventType,
      xpDelta,
      details: JSON.stringify({
        weapon_id: payload.weapon_id || null,
        weapon_name: payload.weapon_name || null,
        vehicle_id: payload.vehicle_id || null,
        vehicle_name: payload.vehicle_name || null,
        distance_meters: payload.distance_meters || null,
        target_id: payload.target_id || payload.target_reforger_id || null,
        target_name: payload.target_name || null,
        target_type: payload.target_type || null,
        amount: payload.amount || null,
        time_as_medic_seconds: payload.time_as_medic_seconds || null
      })
    }
  );
}

async function closeOpenSessionsForServer(connection, serverId) {
  await connection.execute(
    `UPDATE player_sessions
     SET ended_at = CURRENT_TIMESTAMP,
         duration_seconds = 0
     WHERE server_id = :serverId AND ended_at IS NULL`,
    { serverId }
  );
}

async function closeOpenSessionsForPlayer(connection, serverId, playerId) {
  await connection.execute(
    `UPDATE player_sessions
     SET ended_at = CURRENT_TIMESTAMP,
         duration_seconds = 0
     WHERE server_id = :serverId AND player_id = :playerId AND ended_at IS NULL`,
    { serverId, playerId }
  );
}

async function recordCombatEvent(server, season, payload) {
  await ensureSupportSchema();
  await killFeedService.ensureKillFeedTable();

  await withPlayer(server, season, payload, async (connection, player, seasonId) => {
    const increments = {
      kill: 'player_kills',
      ai_kill: 'ai_kills',
      death: 'deaths',
      teamkill: 'teamkills',
      assist: 'assists'
    };
    const column = increments[payload.event_type];
    const isWeaponSample = payload.event_type === 'weapon_sample';
    if (!column && !isWeaponSample) return;

    const counterColumn = column || 'assists';
    const counterValue = column ? 1 : 0;

    await connection.execute(
      `INSERT INTO player_stats (server_id, player_id, season_id, ${counterColumn}, longest_kill_meters, shots_fired, hits)
       VALUES (:serverId, :playerId, :seasonId, :counterValue, :longestKill, :shotsFired, :hits)
       ON DUPLICATE KEY UPDATE
         ${counterColumn} = ${counterColumn} + VALUES(${counterColumn}),
         longest_kill_meters = GREATEST(longest_kill_meters, VALUES(longest_kill_meters)),
         shots_fired = shots_fired + VALUES(shots_fired),
         hits = hits + VALUES(hits)`,
      {
        serverId: server.id,
        playerId: player.id,
        seasonId,
        counterValue,
        longestKill: payload.distance_meters || 0,
        shotsFired: payload.shots_fired || 0,
        hits: payload.hits || 0
      }
    );

    if (payload.weapon_id) {
      await connection.execute(
        `INSERT INTO weapon_stats (server_id, player_id, season_id, weapon_id, weapon_name, kills, shots_fired, hits)
         VALUES (:serverId, :playerId, :seasonId, :weaponId, :weaponName, :kills, :shotsFired, :hits)
         ON DUPLICATE KEY UPDATE kills = kills + VALUES(kills), shots_fired = shots_fired + VALUES(shots_fired), hits = hits + VALUES(hits)`,
        {
          serverId: server.id,
          playerId: player.id,
          seasonId,
          weaponId: payload.weapon_id,
          weaponName: payload.weapon_name || null,
          kills: payload.event_type === 'kill' || payload.event_type === 'ai_kill' ? 1 : 0,
          shotsFired: payload.shots_fired || 0,
          hits: payload.hits || 0
        }
      );
    }

    await killFeedService.recordKillFeedEvent(connection, server, player, payload);
    if (payload.rank_name) {
      await connection.execute(
        `UPDATE player_sessions
         SET rank_name = :rankName
         WHERE server_id = :serverId
           AND player_id = :playerId
           AND ended_at IS NULL
         ORDER BY started_at DESC
         LIMIT 1`,
        { serverId: server.id, playerId: player.id, rankName: payload.rank_name }
      );
    }

    await awardXp(connection, server, player, seasonId, 'combat', payload.event_type, payload);
  });
}

async function recordMedicalEvent(server, season, payload) {
  await ensureSupportSchema();
  await withPlayer(server, season, payload, async (connection, player, seasonId) => {
    const fields = { revive: 'revives', bandage: 'bandages_used', tourniquet: 'tourniquets_used', heal: 'heals' };
    const column = fields[payload.event_type];
    if (!column) return;
    const amount = parseNonNegativeNumber(payload.amount);
    const medicSeconds = parseNonNegativeInt(payload.time_as_medic_seconds);
    await connection.execute(
      `INSERT INTO medical_stats (server_id, player_id, season_id, ${column}, treatment_amount, time_as_medic_seconds)
       VALUES (:serverId, :playerId, :seasonId, 1, :amount, :medicSeconds)
       ON DUPLICATE KEY UPDATE
         ${column} = ${column} + 1,
         treatment_amount = treatment_amount + VALUES(treatment_amount),
         time_as_medic_seconds = time_as_medic_seconds + VALUES(time_as_medic_seconds)`,
      {
        serverId: server.id,
        playerId: player.id,
        seasonId,
        amount,
        medicSeconds
      }
    );

    await connection.execute(
      `INSERT INTO medical_events
        (server_id, player_id, season_id, event_type, player_name, target_reforger_id, target_name, target_type, amount, time_as_medic_seconds)
       VALUES (:serverId, :playerId, :seasonId, :eventType, :playerName, :targetReforgerId, :targetName, :targetType, :amount, :medicSeconds)`,
      {
        serverId: server.id,
        playerId: player.id,
        seasonId,
        eventType: payload.event_type,
        playerName: payload.player_name || null,
        targetReforgerId: payload.target_reforger_id || payload.target_id || null,
        targetName: payload.target_name || null,
        targetType: payload.target_type || null,
        amount,
        medicSeconds
      }
    );

    await awardXp(connection, server, player, seasonId, 'medical', payload.event_type, payload);
  });
}

async function recordVehicleEvent(server, season, payload) {
  await ensureSupportSchema();
  await withPlayer(server, season, payload, async (connection, player, seasonId) => {
    const isTravelOnly = payload.event_type === 'travel';
    await connection.execute(
      `INSERT INTO vehicle_stats
        (server_id, player_id, season_id, vehicle_id, vehicle_name, kills, deaths, assists, destroyed, crashes, repairs, distance_driven_meters, distance_passenger_meters, time_in_vehicle_seconds)
       VALUES (:serverId, :playerId, :seasonId, :vehicleId, :vehicleName, :kills, :deaths, :assists, :destroyed, :crashes, :repairs, :driven, :passenger, :seconds)
       ON DUPLICATE KEY UPDATE
         kills = kills + VALUES(kills), deaths = deaths + VALUES(deaths), assists = assists + VALUES(assists),
         destroyed = destroyed + VALUES(destroyed), crashes = crashes + VALUES(crashes), repairs = repairs + VALUES(repairs),
         distance_driven_meters = distance_driven_meters + VALUES(distance_driven_meters),
         distance_passenger_meters = distance_passenger_meters + VALUES(distance_passenger_meters),
         time_in_vehicle_seconds = time_in_vehicle_seconds + VALUES(time_in_vehicle_seconds)`,
      {
        serverId: server.id,
        playerId: player.id,
        seasonId,
        vehicleId: payload.vehicle_id || 'unknown',
        vehicleName: payload.vehicle_name || null,
        kills: payload.event_type === 'kill' ? 1 : 0,
        deaths: payload.event_type === 'death' ? 1 : 0,
        assists: payload.event_type === 'assist' && !isTravelOnly ? 1 : 0,
        destroyed: payload.event_type === 'destroyed' ? 1 : 0,
        crashes: payload.event_type === 'crash' ? 1 : 0,
        repairs: payload.event_type === 'repair' ? 1 : 0,
        driven: payload.distance_driven_meters || 0,
        passenger: payload.distance_passenger_meters || 0,
        seconds: payload.time_in_vehicle_seconds || 0
      }
    );
    await awardXp(connection, server, player, seasonId, 'vehicle', payload.event_type, payload);
  });
}

async function recordMovementUpdate(server, season, payload) {
  await withPlayer(server, season, payload, async (connection, player, seasonId) => {
    // TODO: Enforce Reforger-side movement sanity checks too: ignore dead players, teleports, and impossible speed spikes.
    await connection.execute(
      `INSERT INTO movement_stats
        (server_id, player_id, season_id, distance_foot_meters, distance_vehicle_meters, sprint_distance_meters, swim_distance_meters, time_on_foot_seconds, time_mounted_seconds)
       VALUES (:serverId, :playerId, :seasonId, :foot, :vehicle, :sprint, :swim, :footSeconds, :mountedSeconds)
       ON DUPLICATE KEY UPDATE
         distance_foot_meters = distance_foot_meters + VALUES(distance_foot_meters),
         distance_vehicle_meters = distance_vehicle_meters + VALUES(distance_vehicle_meters),
         sprint_distance_meters = sprint_distance_meters + VALUES(sprint_distance_meters),
         swim_distance_meters = swim_distance_meters + VALUES(swim_distance_meters),
         time_on_foot_seconds = time_on_foot_seconds + VALUES(time_on_foot_seconds),
         time_mounted_seconds = time_mounted_seconds + VALUES(time_mounted_seconds)`,
      {
        serverId: server.id,
        playerId: player.id,
        seasonId,
        foot: payload.distance_foot_meters || 0,
        vehicle: payload.distance_vehicle_meters || 0,
        sprint: payload.sprint_distance_meters || 0,
        swim: payload.swim_distance_meters || 0,
        footSeconds: payload.time_on_foot_seconds || 0,
        mountedSeconds: payload.time_mounted_seconds || 0
      }
    );
  });
}

async function recordObjectiveEvent(server, season, payload) {
  await ensureSupportSchema();
  await withPlayer(server, season, payload, async (connection, player, seasonId) => {
    const fields = {
      capture: 'captures',
      defense: 'defenses',
      objective_completed: 'objectives_completed',
      mission_participation: 'mission_participation',
      pvp_win: 'pvp_wins',
      pvp_loss: 'pvp_losses'
    };
    const column = fields[payload.event_type];
    if (!column) return;
    await connection.execute(
      `INSERT INTO objective_stats (server_id, player_id, season_id, ${column})
       VALUES (:serverId, :playerId, :seasonId, 1)
       ON DUPLICATE KEY UPDATE ${column} = ${column} + 1`,
      { serverId: server.id, playerId: player.id, seasonId }
    );
    await awardXp(connection, server, player, seasonId, 'objective', payload.event_type, payload);
  });
}

async function recordSupportEvent(server, season, payload) {
  await ensureSupportSchema();
  await withPlayer(server, season, payload, async (connection, player, seasonId) => {
    const fields = {
      resupply: 'resupplies',
      ammo_resupply: 'resupplies',
      supply_delivery: 'supply_deliveries',
      repair: 'repairs',
      vehicle_repair: 'repairs',
      build: 'builds',
      fortification: 'builds',
      transport: 'transports',
      teamwork: 'teamwork_actions',
      squad_support: 'teamwork_actions',
      spot: 'teamwork_actions',
      deploy_spawn: 'teamwork_actions'
    };
    const column = fields[payload.event_type];
    if (!column) return;
    const amount = parseNonNegativeNumber(payload.amount);

    await connection.execute(
      `INSERT INTO support_stats (server_id, player_id, season_id, ${column}, support_amount)
       VALUES (:serverId, :playerId, :seasonId, 1, :amount)
       ON DUPLICATE KEY UPDATE
         ${column} = ${column} + 1,
         support_amount = support_amount + VALUES(support_amount)`,
      { serverId: server.id, playerId: player.id, seasonId, amount }
    );

    await connection.execute(
      `INSERT INTO support_events
        (server_id, player_id, season_id, event_type, player_name, target_id, target_name, target_type, amount)
       VALUES (:serverId, :playerId, :seasonId, :eventType, :playerName, :targetId, :targetName, :targetType, :amount)`,
      {
        serverId: server.id,
        playerId: player.id,
        seasonId,
        eventType: payload.event_type,
        playerName: payload.player_name || null,
        targetId: payload.target_id || payload.target_reforger_id || null,
        targetName: payload.target_name || null,
        targetType: payload.target_type || null,
        amount
      }
    );

    await awardXp(connection, server, player, seasonId, 'support', payload.event_type, payload);
  });
}

async function getPlayerSnapshot(server, season, reforgerPlayerId) {
  await ensureSupportSchema();
  await killFeedService.ensureKillFeedTable();
  const [[player]] = await pool.execute(
    'SELECT id, reforger_player_id, display_name FROM players WHERE reforger_player_id = :reforgerPlayerId LIMIT 1',
    { reforgerPlayerId }
  );

  if (!player) {
    return {
      player_kills: 0,
      ai_kills: 0,
      deaths: 0,
      kd: '0.00',
      rank: null,
      xp: 0
    };
  }

  const [[session]] = await pool.execute(
    `SELECT id, started_at, rank_name
     FROM player_sessions
     WHERE server_id = :serverId
       AND player_id = :playerId
     ORDER BY ended_at IS NULL DESC, started_at DESC
     LIMIT 1`,
    { serverId: server.id, playerId: player.id }
  );

  const sessionStartedAt = session?.started_at || new Date();

  const [[stats]] = await pool.execute(
    `SELECT
       SUM(CASE WHEN event_type = 'kill' THEN 1 ELSE 0 END) AS player_kills,
       SUM(CASE WHEN event_type = 'ai_kill' THEN 1 ELSE 0 END) AS ai_kills,
       SUM(CASE WHEN event_type = 'teamkill' THEN 1 ELSE 0 END) AS teamkills
     FROM kill_feed_events
     WHERE server_id = :serverId
       AND player_id = :playerId
       AND created_at >= :sessionStartedAt`,
    { serverId: server.id, playerId: player.id, sessionStartedAt }
  );

  const [[deathStats]] = await pool.execute(
    `SELECT COUNT(*) AS deaths
     FROM kill_feed_events
     WHERE server_id = :serverId
       AND target_reforger_id = :targetReforgerId
       AND event_type IN ('kill', 'teamkill')
       AND created_at >= :sessionStartedAt`,
    { serverId: server.id, targetReforgerId: player.reforger_player_id, sessionStartedAt }
  );

  const [[xpRow]] = await pool.execute(
    `SELECT COALESCE(SUM(xp_delta), 0) AS xp
     FROM xp_events
     WHERE server_id = :serverId
       AND player_id = :playerId
       AND created_at >= :sessionStartedAt`,
    { serverId: server.id, playerId: player.id, sessionStartedAt }
  );

  const playerKills = Number(stats.player_kills || 0);
  const aiKills = Number(stats.ai_kills || 0);
  const kills = playerKills + aiKills;
  const deaths = Number(deathStats.deaths || 0);
  const xp = Number(xpRow.xp || 0);
  const [[rankRow]] = await pool.execute(
    `SELECT COUNT(*) + 1 AS rank
     FROM (
       SELECT sess.player_id, COALESCE(SUM(xp.xp_delta), 0) AS session_xp
       FROM player_sessions sess
       LEFT JOIN xp_events xp
         ON xp.server_id = sess.server_id
        AND xp.player_id = sess.player_id
        AND xp.created_at >= sess.started_at
       WHERE sess.server_id = :serverId
         AND sess.ended_at IS NULL
       GROUP BY sess.player_id
       HAVING session_xp > :xp
     ) ranked`,
    { serverId: server.id, xp }
  );

  const kd = (kills / Math.max(deaths, 1)).toFixed(2);

  return {
    kills,
    player_kills: playerKills,
    ai_kills: aiKills,
    deaths,
    teamkills: Number(stats.teamkills || 0),
    kd,
    rank: Number(rankRow.rank || 1),
    rank_name: session?.rank_name || null,
    xp,
    session_id: session?.id || null
  };
}

async function startSession(server, season, payload) {
  await withPlayer(server, season, payload, async (connection, player, seasonId) => {
    await closeOpenSessionsForPlayer(connection, server.id, player.id);

    await connection.execute(
      `INSERT INTO player_sessions (server_id, player_id, season_id, faction, rank_name, started_at)
       VALUES (:serverId, :playerId, :seasonId, :faction, :rankName, COALESCE(:startedAt, CURRENT_TIMESTAMP))`,
      { serverId: server.id, playerId: player.id, seasonId, faction: payload.faction || null, rankName: payload.rank_name || null, startedAt: payload.started_at || null }
    );
  });
}

async function endSession(server, payload) {
  const connection = await pool.getConnection();
  try {
    const player = await ensurePlayer(connection, payload);
    await connection.execute(
      `UPDATE player_sessions
       SET ended_at = COALESCE(:endedAt, CURRENT_TIMESTAMP),
           duration_seconds = TIMESTAMPDIFF(SECOND, started_at, COALESCE(:endedAt, CURRENT_TIMESTAMP))
       WHERE server_id = :serverId AND player_id = :playerId AND ended_at IS NULL
       ORDER BY started_at DESC
       LIMIT 1`,
      { serverId: server.id, playerId: player.id, endedAt: payload.ended_at || null }
    );
  } finally {
    connection.release();
  }
}

async function startMatch(server, payload) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await closeOpenSessionsForServer(connection, server.id);
    await connection.execute(
      `INSERT INTO matches (server_id, external_match_id, scenario, started_at)
       VALUES (:serverId, :externalMatchId, :scenario, COALESCE(:startedAt, CURRENT_TIMESTAMP))`,
      {
        serverId: server.id,
        externalMatchId: payload.external_match_id || null,
        scenario: payload.scenario || null,
        startedAt: payload.started_at || null
      }
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function closeOpenServerSessions(server) {
  await pool.execute(
    `UPDATE player_sessions
     SET ended_at = CURRENT_TIMESTAMP,
         duration_seconds = 0
     WHERE server_id = :serverId AND ended_at IS NULL`,
    { serverId: server.id }
  );
}

async function listOpenSessions({ serverId = null, limit = 15 } = {}) {
  const rowLimit = parsePositiveInt(limit, 15);
  const [rows] = await pool.execute(
    `SELECT s.server_id, s.name AS server_name, p.display_name, p.reforger_player_id,
            sess.started_at,
            TIMESTAMPDIFF(SECOND, sess.started_at, CURRENT_TIMESTAMP) AS elapsed_seconds
     FROM player_sessions sess
     JOIN servers s ON s.id = sess.server_id
     JOIN players p ON p.id = sess.player_id
     WHERE sess.ended_at IS NULL
       AND (:serverId IS NULL OR s.server_id = :serverId)
     ORDER BY sess.started_at ASC
     LIMIT ${rowLimit}`,
    { serverId }
  );
  return rows;
}

async function closeStaleOpenSessions({ serverId = null, olderThanMinutes = 60 } = {}) {
  const minutes = parsePositiveInt(olderThanMinutes, 60);
  const [result] = await pool.execute(
    `UPDATE player_sessions sess
     JOIN servers s ON s.id = sess.server_id
     SET sess.ended_at = CURRENT_TIMESTAMP,
         sess.duration_seconds = 0
     WHERE sess.ended_at IS NULL
       AND sess.started_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL :minutes MINUTE)
       AND (:serverId IS NULL OR s.server_id = :serverId)`,
    { minutes, serverId }
  );
  return result.affectedRows || 0;
}

async function listRecentSupportEvents({ serverId = null, type = 'all', limit = 15 } = {}) {
  await ensureSupportSchema();
  const rowLimit = Math.min(parsePositiveInt(limit, 15), 25);
  if (!['all', 'medical', 'support'].includes(type)) {
    const error = new Error(`Unsupported event family: ${type}`);
    error.statusCode = 400;
    throw error;
  }

  const includeMedical = type === 'all' || type === 'medical';
  const includeSupport = type === 'all' || type === 'support';
  const queries = [];

  if (includeMedical) {
    queries.push(
      `SELECT 'medical' AS family,
              me.event_type,
              s.server_id,
              me.player_name,
              p.reforger_player_id,
              me.target_name,
              me.target_reforger_id AS target_id,
              me.target_type,
              me.amount,
              me.time_as_medic_seconds,
              me.created_at
       FROM medical_events me
       JOIN servers s ON s.id = me.server_id
       JOIN players p ON p.id = me.player_id
       WHERE (:serverId IS NULL OR s.server_id = :serverId)`
    );
  }

  if (includeSupport) {
    queries.push(
      `SELECT 'support' AS family,
              se.event_type,
              s.server_id,
              se.player_name,
              p.reforger_player_id,
              se.target_name,
              se.target_id,
              se.target_type,
              se.amount,
              NULL AS time_as_medic_seconds,
              se.created_at
       FROM support_events se
       JOIN servers s ON s.id = se.server_id
       JOIN players p ON p.id = se.player_id
       WHERE (:serverId IS NULL OR s.server_id = :serverId)`
    );
  }

  if (queries.length === 0) {
    return [];
  }

  const [rows] = await pool.execute(
    `SELECT *
     FROM (${queries.join(' UNION ALL ')}) recent_events
     ORDER BY created_at DESC
     LIMIT ${rowLimit}`,
    { serverId }
  );

  return rows;
}

async function endMatch(server, payload) {
  if (!payload.external_match_id) {
    await pool.execute(
      `UPDATE matches
       SET ended_at = COALESCE(:endedAt, CURRENT_TIMESTAMP), winning_faction = :winningFaction
       WHERE server_id = :serverId AND ended_at IS NULL
       ORDER BY started_at DESC
       LIMIT 1`,
      {
        serverId: server.id,
        endedAt: payload.ended_at || null,
        winningFaction: payload.winning_faction || null
      }
    );
    return;
  }

  await pool.execute(
    `UPDATE matches
     SET ended_at = COALESCE(:endedAt, CURRENT_TIMESTAMP), winning_faction = :winningFaction
     WHERE server_id = :serverId AND external_match_id = :externalMatchId`,
    {
      serverId: server.id,
      externalMatchId: payload.external_match_id,
      endedAt: payload.ended_at || null,
      winningFaction: payload.winning_faction || null
    }
  );
}

async function adjustPlayerStat({ serverId, reforgerPlayerId, displayName, seasonId = null, stat, delta }) {
  if (!ADJUSTABLE_PLAYER_STATS.has(stat)) {
    const error = new Error(`Unsupported stat adjustment: ${stat}`);
    error.statusCode = 400;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[server]] = await connection.execute(
      'SELECT id FROM servers WHERE server_id = :serverId LIMIT 1',
      { serverId }
    );
    if (!server) {
      const error = new Error('Server not found');
      error.statusCode = 404;
      throw error;
    }

    const player = await ensurePlayer(connection, {
      player_reforger_id: reforgerPlayerId,
      player_name: displayName || null
    });
    const insertValue = Math.max(delta, 0);

    await connection.execute(
      `INSERT INTO player_stats (server_id, player_id, season_id, ${stat})
       VALUES (:serverDbId, :playerId, :seasonId, :insertValue)
       ON DUPLICATE KEY UPDATE ${stat} = GREATEST(CAST(${stat} AS SIGNED) + :delta, 0)`,
      {
        serverDbId: server.id,
        playerId: player.id,
        seasonId,
        insertValue,
        delta
      }
    );

    await connection.commit();
    return { serverDbId: server.id, playerId: player.id };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  recordCombatEvent,
  recordMedicalEvent,
  recordVehicleEvent,
  recordMovementUpdate,
  recordObjectiveEvent,
  recordSupportEvent,
  getPlayerSnapshot,
  startSession,
  endSession,
  startMatch,
  endMatch,
  closeOpenServerSessions,
  listOpenSessions,
  closeStaleOpenSessions,
  listRecentSupportEvents,
  adjustPlayerStat,
  ensureSupportSchema
};
