const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const leaderboardService = require('../../services/leaderboardService');
const { addSeasonOption, resolveSeasonId } = require('../services/seasonFilter');

const data = addSeasonOption(new SlashCommandBuilder()
  .setName('topvehicles')
  .setDescription('Show top vehicle stats.')
  .addStringOption((option) => option.setName('server').setDescription('Server ID filter').setRequired(false))
  .addStringOption((option) => option.setName('category').setDescription('Category filter').setRequired(false))
  .addIntegerOption((option) => option.setName('limit').setDescription('Number of rows').setRequired(false)));

module.exports = {
  data,
  async execute(interaction) {
    await interaction.deferReply();
    const seasonId = await resolveSeasonId(interaction.options.getString('season'));
    const result = await leaderboardService.getTopVehicles({
      server: interaction.options.getString('server'),
      category: interaction.options.getString('category'),
      season_id: seasonId,
      limit: interaction.options.getInteger('limit') || 10
    });
    const description = result.rows.length
      ? result.rows.map((row, index) => {
          const km = Math.round((row.distance_driven_meters || 0) / 100) / 10;
          return `**${index + 1}.** ${row.vehicle_name}: ${Number(row.kills || 0).toLocaleString()} kills, ${km.toLocaleString()} km`;
        }).join('\n')
      : 'No vehicle stats yet.';
    await interaction.editReply({
      embeds: [new EmbedBuilder().setTitle('Top Vehicles').setDescription(description)]
    });
  }
};
