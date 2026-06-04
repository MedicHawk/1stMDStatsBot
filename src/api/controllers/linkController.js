const { requireFields } = require('../../utils/validators');
const linkService = require('../../services/linkService');
const logger = require('../../utils/logger');

async function verifyLinkCode(req, res, next) {
  try {
    logger.info({
      server_id: req.server?.server_id,
      code_length: req.body?.code?.length,
      has_player_reforger_id: Boolean(req.body?.player_reforger_id),
      player_name: req.body?.player_name
    }, 'Link verify request received');

    requireFields(req.body, ['code', 'player_reforger_id']);
    const result = await linkService.verifyInGameCode(req.body);
    logger.info({
      server_id: req.server?.server_id,
      player_reforger_id: req.body.player_reforger_id
    }, 'Link verify request accepted');
    res.json(result);
  } catch (error) {
    logger.warn({
      server_id: req.server?.server_id,
      code_length: req.body?.code?.length,
      has_player_reforger_id: Boolean(req.body?.player_reforger_id),
      error: error.message
    }, 'Link verify request rejected');
    next(error);
  }
}

module.exports = {
  verifyLinkCode
};
