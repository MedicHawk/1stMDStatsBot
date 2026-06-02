const { SlashCommandBuilder } = require('discord.js');
const leaderboardService = require('../../services/leaderboardService');
const leaderboardEmbed = require('../embeds/leaderboardEmbed');
const { addSeasonOption, resolveSeasonId } = require('../services/seasonFilter');

const data = addSeasonOption(new SlashCommandBuilder()
  .setName('tophours')
  .setDescription('Show players with the most tracked play time.')
  .addStringOption((option) => option.setName('server').setDescription('Server ID filter').setRequired(false))
  .addStringOption((option) => option.setName('category').setDescription('Category filter').setRequired(false)));

module.exports = {
  data,
  async execute(interaction) {
    const seasonId = await resolveSeasonId(interaction.options.getString('season'));
    const result = await leaderboardService.getLeaderboard('hours', {
      server: interaction.options.getString('server'),
      category: interaction.options.getString('category'),
      season_id: seasonId
    });
    await interaction.reply({ embeds: [leaderboardEmbed(result)] });
  }
};
