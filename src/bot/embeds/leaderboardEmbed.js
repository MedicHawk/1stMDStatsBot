const { EmbedBuilder } = require('discord.js');

function leaderboardEmbed(result) {
  const rows = result.rows || [];
  const description = rows.length
    ? rows.map((row, index) => `**${index + 1}.** ${row.display_name || row.reforger_player_id}: ${Number(row.value || 0).toLocaleString()}`).join('\n')
    : 'No results yet.';

  return new EmbedBuilder()
    .setTitle(`${result.type} leaderboard`)
    .setDescription(description)
    .setFooter({ text: result.cached ? `Cached at ${result.refreshed_at}` : 'Live placeholder query' });
}

module.exports = leaderboardEmbed;
