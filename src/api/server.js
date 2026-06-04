require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const ingestRoutes = require('./routes/ingestRoutes');
const linkRoutes = require('./routes/linkRoutes');
const statusRoutes = require('./routes/statusRoutes');
const publicRoutes = require('./routes/publicRoutes');
const pool = require('../db/pool');

const app = express();

app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));

app.use(helmet());
app.use(express.json({
  limit: '1mb',
  type: (req) => req.is('application/json') || req.originalUrl.startsWith('/api/')
}));
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false
}));

app.use((req, res, next) => {
  res.on('finish', () => {
    if (!req.path.startsWith('/api/') || res.statusCode !== 202) return;

    logger.info({
      path: req.path,
      server_id: req.server?.server_id,
      player_reforger_id: req.body?.player_reforger_id,
      event_type: req.body?.event_type
    }, 'Accepted stats API request');
  });

  next();
});

app.get('/', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>1stMD Stats API</title>
</head>
<body>
  <main>
    <h1>1stMD Stats API</h1>
    <p>The stats API is running.</p>
    <ul>
      <li><a href="/health">API health</a></li>
      <li><a href="/health/db">Database health</a></li>
      <li><a href="/api/public/servers">Servers</a></li>
      <li><a href="/api/public/leaderboards/kills">Kills leaderboard</a></li>
    </ul>
  </main>
</body>
</html>`);
});

app.get('/health', (req, res) => {
  res.json({ ok: true, service: '1stmd-stats-api' });
});

app.get('/health/db', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: true });
  } catch (error) {
    next(error);
  }
});

app.use('/api/ingest', ingestRoutes);
app.use('/api/link', linkRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/public', publicRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  logger.error({ err, path: req.path }, 'API request failed');
  res.status(err.statusCode || 500).json({
    error: err.publicMessage || err.message || 'Internal server error'
  });
});

if (require.main === module) {
  const port = Number(process.env.API_PORT || 3000);
  app.listen(port, () => logger.info({ port }, 'API listening'));
}

module.exports = app;
