const { EmbedBuilder } = require('discord.js');
const { formatUtc } = require('../../utils/time');

function serverEmbed(server, mods = []) {
  return new EmbedBuilder()
    .setTitle(server.name)
    .addFields(
      { name: 'Category', value: server.category || 'unknown', inline: true },
      { name: 'Status', value: server.current_status || 'unknown', inline: true },
      { name: 'Players', value: `${server.current_player_count || 0}/${server.max_player_slots || '?'}`, inline: true },
      { name: 'Map/Scenario', value: server.current_map || 'Unavailable', inline: true },
      { name: 'BattleMetrics Rank', value: server.battlemetrics_rank ? `#${server.battlemetrics_rank}` : 'Unavailable', inline: true },
      { name: 'Mods', value: `${mods.length} installed`, inline: true }
    )
    .setFooter({ text: `Last heartbeat: ${formatUtc(server.last_heartbeat_at)}` });
}

module.exports = serverEmbed;
