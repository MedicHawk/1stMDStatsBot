const { requireFields } = require('../../utils/validators');
const linkService = require('../../services/linkService');

async function verifyLinkCode(req, res, next) {
  try {
    requireFields(req.body, ['code', 'player_reforger_id']);
    const result = await linkService.verifyInGameCode(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  verifyLinkCode
};
