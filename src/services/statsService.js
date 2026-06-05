const pool = require('../db/pool');

const ADJUSTABLE_PLAYER_STATS = new Set([
  'player_kills',
  'ai_kills',
  'deaths',
  'teamkills',
  'assists',
  'shots_fired',
  'hits'
]);

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
  });
}

async function recordMedicalEvent(server, season, payload) {
  await withPlayer(server, season, payload, async (connection, player, seasonId) => {
    const fields = { revive: 'revives', bandage: 'bandages_used', tourniquet: 'tourniquets_used' };
    const column = fields[payload.event_type];
    if (!column) return;
    await connection.execute(
      `INSERT INTO medical_stats (server_id, player_id, season_id, ${column}, time_as_medic_seconds)
       VALUES (:serverId, :playerId, :seasonId, 1, :medicSeconds)
       ON DUPLICATE KEY UPDATE ${column} = ${column} + 1, time_as_medic_seconds = time_as_medic_seconds + VALUES(time_as_medic_seconds)`,
      {
        serverId: server.id,
        playerId: player.id,
        seasonId,
        medicSeconds: payload.time_as_medic_seconds || 0
      }
    );
  });
}

async function recordVehicleEvent(server, season, payload) {
  await withPlayer(server, season, payload, async (connection, player, seasonId) => {
    const isTravelOnly = payload.event_type === 'travel';
    await connection.execute(
      `INSERT INTO vehicle_stats
        (server_id, player_id, season_id, vehicle_id, vehicle_name, kills, deaths, assists, destroyed, crashes, distance_driven_meters, distance_passenger_meters, time_in_vehicle_seconds)
       VALUES (:serverId, :playerId, :seasonId, :vehicleId, :vehicleName, :kills, :deaths, :assists, :destroyed, :crashes, :driven, :passenger, :seconds)
       ON DUPLICATE KEY UPDATE
         kills = kills + VALUES(kills), deaths = deaths + VALUES(deaths), assists = assists + VALUES(assists),
         destroyed = destroyed + VALUES(destroyed), crashes = crashes + VALUES(crashes),
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
        driven: payload.distance_driven_meters || 0,
        passenger: payload.distance_passenger_meters || 0,
        seconds: payload.time_in_vehicle_seconds || 0
      }
    );
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
  });
}

async function startSession(server, season, payload) {
  await withPlayer(server, season, payload, async (connection, player, seasonId) => {
    await closeOpenSessionsForPlayer(connection, server.id, player.id);

    await connection.execute(
      `INSERT INTO player_sessions (server_id, player_id, season_id, faction, started_at)
       VALUES (:serverId, :playerId, :seasonId, :faction, COALESCE(:startedAt, CURRENT_TIMESTAMP))`,
      { serverId: server.id, playerId: player.id, seasonId, faction: payload.faction || null, startedAt: payload.started_at || null }
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
  startSession,
  endSession,
  startMatch,
  endMatch,
  closeOpenServerSessions,
  adjustPlayerStat
};
