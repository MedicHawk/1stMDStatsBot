const { EmbedBuilder } = require('discord.js');
const pool = require('../db/pool');
const statsService = require('./statsService');
const serverService = require('./serverService');
const { formatUtc } = require('../utils/time');

function formatAmount(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'None';
  }

  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function eventTitle(event) {
  const family = event.family === 'medical' ? 'Medical' : 'Support';
  return `${family}: ${String(event.event_type || 'event').replace(/_/g, ' ')}`;
}

function eventDescription(event) {
  const actor = event.player_name || 'Unknown player';
  const target = event.target_name || event.target_id || 'No target';
  if (target === 'No target') {
    return `${actor} logged ${event.event_type}`;
  }

  return `${actor} -> ${target}`;
}

async function listPendingSupportFeedEvents(limit = 25) {
  await serverService.ensureServerFeatureColumns();
  await statsService.ensureSupportSchema();

  const rowLimit = Math.max(Math.min(Number.parseInt(limit, 10) || 25, 100), 1);
  const [rows] = await pool.execute(
    `SELECT *
     FROM (
       SELECT me.id,
              'medical' AS family,
              me.event_type,
              me.player_name,
              me.target_name,
              me.target_reforger_id AS target_id,
              me.target_type,
              me.amount,
              me.time_as_medic_seconds,
              me.created_at,
              s.server_id,
              s.name AS server_name,
              s.support_feed_channel_id
       FROM medical_events me
       JOIN servers s ON s.id = me.server_id
       WHERE me.posted_at IS NULL
         AND s.enabled = TRUE
         AND s.support_feed_enabled = TRUE
         AND s.support_feed_channel_id IS NOT NULL
       UNION ALL
       SELECT se.id,
              'support' AS family,
              se.event_type,
              se.player_name,
              se.target_name,
              se.target_id,
              se.target_type,
              se.amount,
              NULL AS time_as_medic_seconds,
              se.created_at,
              s.server_id,
              s.name AS server_name,
              s.support_feed_channel_id
       FROM support_events se
       JOIN servers s ON s.id = se.server_id
       WHERE se.posted_at IS NULL
         AND s.enabled = TRUE
         AND s.support_feed_enabled = TRUE
         AND s.support_feed_channel_id IS NOT NULL
     ) pending_events
     ORDER BY created_at ASC, id ASC
     LIMIT ${rowLimit}`
  );
  return rows;
}

async function markSupportFeedEventPosted(event) {
  const table = event.family === 'medical' ? 'medical_events' : 'support_events';
  await pool.execute(
    `UPDATE ${table} SET posted_at = CURRENT_TIMESTAMP WHERE id = :eventId`,
    { eventId: event.id }
  );
}

function buildSupportFeedEmbed(event) {
  const fields = [
    { name: 'Server', value: event.server_name || event.server_id, inline: true },
    { name: 'Amount', value: formatAmount(event.amount), inline: true }
  ];

  if (event.time_as_medic_seconds) {
    fields.push({ name: 'Medic Time', value: `${event.time_as_medic_seconds}s`, inline: true });
  }

  return new EmbedBuilder()
    .setTitle(eventTitle(event))
    .setDescription(eventDescription(event))
    .addFields(fields)
    .setFooter({ text: `Logged ${formatUtc(event.created_at)}` });
}

module.exports = {
  listPendingSupportFeedEvents,
  markSupportFeedEventPosted,
  buildSupportFeedEmbed
};
