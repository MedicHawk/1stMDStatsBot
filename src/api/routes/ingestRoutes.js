const express = require('express');
const serverAuth = require('../middleware/serverAuth');
const controller = require('../controllers/ingestController');

const router = express.Router();

router.use(serverAuth);
router.post('/combat', controller.combatEvent);
router.post('/medical', controller.medicalEvent);
router.post('/vehicle', controller.vehicleEvent);
router.post('/movement', controller.movementUpdate);
router.post('/objective', controller.objectiveEvent);
router.post('/snapshot', controller.snapshotEvent);
router.post('/support', controller.supportEvent);
router.post('/smoke-test', controller.smokeTest);
router.post('/session/start', controller.sessionStart);
router.post('/session/end', controller.sessionEnd);

module.exports = router;
