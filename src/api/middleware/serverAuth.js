const bcrypt = require('bcryptjs');
const pool = require('../../db/pool');
const logger = require('../../utils/logger');

function cleanCredential(value) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

async function serverAuth(req, res, next) {
  try {
    const serverId = cleanCredential(req.header('x-server-id') || req.body.server_id || req.query.server_id);
    const apiKey = cleanCredential(req.header('x-api-key') || req.body.api_key || req.query.api_key);
    const credentialSource = req.header('x-api-key')
      ? 'header'
      : req.body.api_key
        ? 'body'
        : req.query.api_key
          ? 'query'
          : 'missing';

    if (!serverId || !apiKey) {
      logger.warn({
        path: req.path,
        credential_source: credentialSource,
        has_server_id: Boolean(serverId),
        has_api_key: Boolean(apiKey)
      }, 'Missing server API credentials');
      return res.status(401).json({ error: 'Missing server credentials' });
    }

    const [rows] = await pool.execute(
      `SELECT s.*, c.slug AS category_slug
       FROM servers s
       JOIN server_categories c ON c.id = s.category_id
       WHERE s.server_id = :serverId AND s.enabled = TRUE
       LIMIT 1`,
      { serverId }
    );

    const server = rows[0];
    if (!server || !(await bcrypt.compare(apiKey, server.api_key_hash))) {
      logger.warn({
        path: req.path,
        server_id: serverId,
        credential_source: credentialSource,
        api_key_length: apiKey.length,
        server_found: Boolean(server)
      }, 'Invalid server API credentials');
      return res.status(401).json({ error: 'Invalid server credentials' });
    }

    req.server = server;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = serverAuth;
