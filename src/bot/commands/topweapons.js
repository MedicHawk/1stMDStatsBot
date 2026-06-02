const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const leaderboardService = require('../../services/leaderboardService');
const { addSeasonOption, resolveSeasonId } = require('../services/seasonFilter');

const data = addSeasonOption(new SlashCommandBuilder()
  .setName('topweapons')
  .setDescription('Show top weapon stats.')
  .addStringOption((option) => option.setName('server').setDescription('Server ID filter').setRequired(false))
  .addStringOption((option) => option.setName('category').setDescription('Category filter').setRequired(false))
  .addIntegerOption((option) => option.setName('limit').setDescription('Number of rows').setRequired(false)));

module.exports = {
  data,
  async execute(interaction) {
    await interaction.deferReply();
    const seasonId = await resolveSeasonId(interaction.options.getString('season'));
    const result = await leaderboardService.getTopWeapons({
      server: interaction.options.getString('server'),
      category: interaction.options.getString('category'),
      season_id: seasonId,
      limit: interaction.options.getInteger('limit') || 10
    });
    const description = result.rows.length
      ? result.rows.map((row, index) => {
          const accuracy = row.shots_fired > 0 ? `, ${Math.round((row.hits / row.shots_fired) * 100)}% acc` : '';
          return `**${index + 1}.** ${row.weapon_name}: ${Number(row.kills || 0).toLocaleString()} kills${accuracy}`;
        }).join('\n')
      : 'No weapon stats yet.';
    await interaction.editReply({
      embeds: [new EmbedBuilder().setTitle('Top Weapons').setDescription(description)]
    });
  }
};
