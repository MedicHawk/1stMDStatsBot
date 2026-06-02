const pool = require('../db/pool');

async function getCurrentSeason() {
  const [rows] = await pool.execute(
    `SELECT * FROM seasons
     WHERE is_active = TRUE AND starts_at <= CURRENT_TIMESTAMP AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)
     ORDER BY starts_at DESC
     LIMIT 1`
  );
  return rows[0] || null;
}

async function listSeasons() {
  const [rows] = await pool.execute(
    `SELECT id, name, starts_at, ends_at, is_active
     FROM seasons
     ORDER BY starts_at DESC
     LIMIT 25`
  );
  return rows;
}

async function createSeason(name, startsAt) {
  await pool.execute(
    'INSERT INTO seasons (name, starts_at, is_active) VALUES (:name, :startsAt, TRUE)',
    { name, startsAt }
  );
}

async function closeSeason(id) {
  await pool.execute(
    'UPDATE seasons SET is_active = FALSE, ends_at = CURRENT_TIMESTAMP WHERE id = :id',
    { id }
  );
}

module.exports = {
  getCurrentSeason,
  listSeasons,
  createSeason,
  closeSeason
};
