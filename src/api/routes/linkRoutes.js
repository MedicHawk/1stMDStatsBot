const express = require('express');
const serverAuth = require('../middleware/serverAuth');
const controller = require('../controllers/linkController');

const router = express.Router();

router.post('/verify', serverAuth, controller.verifyLinkCode);

module.exports = router;
