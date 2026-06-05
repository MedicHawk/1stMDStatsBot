const { EmbedBuilder } = require('discord.js');
const { formatUtc } = require('../../utils/time');

function formatDuration(seconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds || 0)));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

function formatLeaderboardValue(result, row) {
  if (result.type === 'hours') {
    const seconds = row.value_seconds ?? Number(row.value || 0) * 3600;
    return formatDuration(seconds);
  }

  return Number(row.value || 0).toLocaleString();
}

function leaderboardEmbed(result) {
  const rows = result.rows || [];
  const description = rows.length
    ? rows.map((row, index) => `**${index + 1}.** ${row.display_name || row.reforger_player_id}: ${formatLeaderboardValue(result, row)}`).join('\n')
    : 'No results yet.';

  return new EmbedBuilder()
    .setTitle(`${result.type} leaderboard`)
    .setDescription(description)
    .setFooter({ text: result.cached ? `Cached at ${formatUtc(result.refreshed_at)}` : 'Live placeholder query' });
}

module.exports = leaderboardEmbed;
module.exports.formatDuration = formatDuration;
