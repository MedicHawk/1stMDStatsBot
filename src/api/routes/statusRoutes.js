const express = require('express');
const serverAuth = require('../middleware/serverAuth');
const controller = require('../controllers/statusController');

const router = express.Router();

router.use(serverAuth);
router.post('/heartbeat', controller.heartbeat);
router.post('/mods', controller.updateMods);
router.post('/match/start', controller.matchStart);
router.post('/match/end', controller.matchEnd);

module.exports = router;
