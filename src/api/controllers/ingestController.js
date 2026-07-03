const { requireFields } = require('../../utils/validators');
const statsService = require('../../services/statsService');
const seasonService = require('../../services/seasonService');

const VALID_COMBAT_EVENTS = new Set(['kill', 'ai_kill', 'death', 'teamkill', 'assist', 'weapon_sample']);
const VALID_MEDICAL_EVENTS = new Set(['revive', 'bandage', 'tourniquet', 'heal']);
const VALID_VEHICLE_EVENTS = new Set(['kill', 'death', 'assist', 'destroyed', 'crash', 'travel', 'repair']);
const VALID_OBJECTIVE_EVENTS = new Set(['capture', 'defense', 'objective_completed', 'mission_participation', 'pvp_win', 'pvp_loss']);
const VALID_SUPPORT_EVENTS = new Set([
  'resupply',
  'ammo_resupply',
  'supply_delivery',
  'repair',
  'vehicle_repair',
  'build',
  'fortification',
  'transport',
  'teamwork',
  'squad_support',
  'spot',
  'deploy_spawn'
]);

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function buildStatsToastText(snapshot) {
  const rank = snapshot.rank_name || 'Unranked';
  return `Player Stats\nK/D ${snapshot.kd} | Rank ${rank} | XP ${formatNumber(snapshot.xp)}`;
}

function requireEventType(eventType, validEvents) {
  if (validEvents.has(eventType)) return;
  const error = new Error(`Unsupported event_type: ${eventType}`);
  error.statusCode = 400;
  throw error;
}

async function combatEvent(req, res, next) {
  try {
    requireFields(req.body, ['player_reforger_id', 'event_type']);
    requireEventType(req.body.event_type, VALID_COMBAT_EVENTS);
    const season = await seasonService.getCurrentSeason();
    await statsService.recordCombatEvent(req.server, season, req.body);
    res.status(202).end();
  } catch (error) {
    next(error);
  }
}

async function medicalEvent(req, res, next) {
  try {
    requireFields(req.body, ['player_reforger_id', 'event_type']);
    requireEventType(req.body.event_type, VALID_MEDICAL_EVENTS);
    const season = await seasonService.getCurrentSeason();
    await statsService.recordMedicalEvent(req.server, season, req.body);
    res.status(202).json({ accepted: true });
  } catch (error) {
    next(error);
  }
}

async function vehicleEvent(req, res, next) {
  try {
    requireFields(req.body, ['player_reforger_id', 'event_type']);
    requireEventType(req.body.event_type, VALID_VEHICLE_EVENTS);
    const season = await seasonService.getCurrentSeason();
    await statsService.recordVehicleEvent(req.server, season, req.body);
    res.status(202).json({ accepted: true });
  } catch (error) {
    next(error);
  }
}

async function movementUpdate(req, res, next) {
  try {
    requireFields(req.body, ['player_reforger_id']);
    const season = await seasonService.getCurrentSeason();
    await statsService.recordMovementUpdate(req.server, season, req.body);
    res.status(202).json({ accepted: true });
  } catch (error) {
    next(error);
  }
}

async function objectiveEvent(req, res, next) {
  try {
    requireFields(req.body, ['player_reforger_id', 'event_type']);
    requireEventType(req.body.event_type, VALID_OBJECTIVE_EVENTS);
    const season = await seasonService.getCurrentSeason();
    await statsService.recordObjectiveEvent(req.server, season, req.body);
    res.status(202).json({ accepted: true });
  } catch (error) {
    next(error);
  }
}

async function snapshotEvent(req, res, next) {
  try {
    requireFields(req.body, ['player_reforger_id']);
    const season = await seasonService.getCurrentSeason();
    const snapshot = await statsService.getPlayerSnapshot(req.server, season, req.body.player_reforger_id);
    res.status(202).json(buildStatsToastText(snapshot));
  } catch (error) {
    next(error);
  }
}

async function supportEvent(req, res, next) {
  try {
    requireFields(req.body, ['player_reforger_id', 'event_type']);
    requireEventType(req.body.event_type, VALID_SUPPORT_EVENTS);
    const season = await seasonService.getCurrentSeason();
    await statsService.recordSupportEvent(req.server, season, req.body);
    res.status(202).json({ accepted: true });
  } catch (error) {
    next(error);
  }
}

async function smokeTest(req, res, next) {
  try {
    requireFields(req.body, ['player_reforger_id']);
    const season = await seasonService.getCurrentSeason();
    const basePayload = {
      player_reforger_id: req.body.player_reforger_id,
      player_name: req.body.player_name || 'Smoke Test Player'
    };

    await statsService.startSession(req.server, season, basePayload);
    await statsService.recordCombatEvent(req.server, season, {
      ...basePayload,
      event_type: 'ai_kill',
      weapon_id: 'smoke_test_weapon',
      weapon_name: 'Smoke Test Rifle',
      distance_meters: 42,
      shots_fired: 3,
      hits: 2
    });
    await statsService.recordMedicalEvent(req.server, season, {
      ...basePayload,
      event_type: 'bandage',
      time_as_medic_seconds: 10,
      target_reforger_id: `${basePayload.player_reforger_id}-patient`,
      target_name: 'Smoke Test Patient',
      target_type: 'player',
      amount: 15
    });
    await statsService.recordMedicalEvent(req.server, season, {
      ...basePayload,
      event_type: 'heal',
      time_as_medic_seconds: 5,
      target_reforger_id: `${basePayload.player_reforger_id}-patient`,
      target_name: 'Smoke Test Patient',
      target_type: 'player',
      amount: 25
    });
    await statsService.recordVehicleEvent(req.server, season, {
      ...basePayload,
      event_type: 'travel',
      vehicle_id: 'smoke_test_vehicle',
      vehicle_name: 'Smoke Test Vehicle',
      distance_driven_meters: 100,
      time_in_vehicle_seconds: 30
    });
    await statsService.recordSupportEvent(req.server, season, {
      ...basePayload,
      event_type: 'resupply',
      target_id: `${basePayload.player_reforger_id}-rifleman`,
      target_name: 'Smoke Test Rifleman',
      target_type: 'player',
      amount: 120
    });
    await statsService.recordObjectiveEvent(req.server, season, { ...basePayload, event_type: 'mission_participation' });
    await statsService.recordObjectiveEvent(req.server, season, { ...basePayload, event_type: 'objective_completed' });
    await statsService.endSession(req.server, basePayload);

    res.status(202).json({ accepted: true, smoke_test: true });
  } catch (error) {
    next(error);
  }
}

async function sessionStart(req, res, next) {
  try {
    requireFields(req.body, ['player_reforger_id']);
    const season = await seasonService.getCurrentSeason();
    await statsService.startSession(req.server, season, req.body);
    res.status(202).json({ accepted: true });
  } catch (error) {
    next(error);
  }
}

async function sessionEnd(req, res, next) {
  try {
    requireFields(req.body, ['player_reforger_id']);
    await statsService.endSession(req.server, req.body);
    res.status(202).json({ accepted: true });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  combatEvent,
  medicalEvent,
  vehicleEvent,
  movementUpdate,
  objectiveEvent,
  snapshotEvent,
  supportEvent,
  smokeTest,
  sessionStart,
  sessionEnd
};
