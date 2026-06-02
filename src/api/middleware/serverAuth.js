const bcrypt = require('bcryptjs');
const pool = require('../../db/pool');

async function serverAuth(req, res, next) {
  try {
    const serverId = req.header('x-server-id') || req.body.server_id;
    const apiKey = req.header('x-api-key');

    if (!serverId || !apiKey) {
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
      return res.status(401).json({ error: 'Invalid server credentials' });
    }

    req.server = server;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = serverAuth;
