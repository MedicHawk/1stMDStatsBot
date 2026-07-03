const express = require('express');
const serverService = require('../../services/serverService');
const leaderboardService = require('../../services/leaderboardService');
const statsService = require('../../services/statsService');

const router = express.Router();

router.get('/servers', async (req, res, next) => {
  try {
    res.json({ servers: await serverService.listServers({ enabledOnly: true }) });
  } catch (error) {
    next(error);
  }
});

router.get('/servers/:serverId/mods', async (req, res, next) => {
  try {
    res.json({ mods: await serverService.getServerMods(req.params.serverId) });
  } catch (error) {
    next(error);
  }
});

router.get('/leaderboards/:type', async (req, res, next) => {
  try {
    const leaderboard = await leaderboardService.getLeaderboard(req.params.type, req.query);
    res.json(leaderboard);
  } catch (error) {
    next(error);
  }
});

router.get('/events/recent', async (req, res, next) => {
  try {
    const events = await statsService.listRecentSupportEvents({
      serverId: req.query.server_id || null,
      type: req.query.type || 'all',
      limit: req.query.limit || 15
    });
    res.json({ events });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
