const { requireFields } = require('../../utils/validators');
const serverService = require('../../services/serverService');
const statsService = require('../../services/statsService');
const leaderboardService = require('../../services/leaderboardService');
const logger = require('../../utils/logger');

async function heartbeat(req, res, next) {
  try {
    await serverService.recordHeartbeat(req.server, req.body);
    res.status(202).json({ accepted: true });
  } catch (error) {
    next(error);
  }
}

async function updateMods(req, res, next) {
  try {
    requireFields(req.body, ['mods']);
    await serverService.replaceMods(req.server, req.body.mods);
    res.status(202).json({ accepted: true, mod_count: req.body.mods.length });
  } catch (error) {
    next(error);
  }
}

async function matchStart(req, res, next) {
  try {
    await statsService.startMatch(req.server, req.body);
    res.status(202).json({ accepted: true });
  } catch (error) {
    next(error);
  }
}

async function matchEnd(req, res, next) {
  try {
    await statsService.endMatch(req.server, req.body);
    leaderboardService.refreshDefaultLeaderboards()
      .catch((error) => logger.warn({ error }, 'Leaderboard refresh after match end failed'));
    res.status(202).json({ accepted: true });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  heartbeat,
  updateMods,
  matchStart,
  matchEnd
};
