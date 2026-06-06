const { SlashCommandBuilder } = require('discord.js');
const leaderboardService = require('../../services/leaderboardService');
const leaderboardEmbed = require('../embeds/leaderboardEmbed');
const { addSeasonOption, resolveSeasonId } = require('../services/seasonFilter');

const data = addSeasonOption(new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Show a filtered leaderboard.')
  .addStringOption((option) => option.setName('type').setDescription('kills, aikills, deaths, hours, revives, heals, repairs, support, xp, distance').setRequired(false))
  .addStringOption((option) => option.setName('server').setDescription('Server ID filter').setRequired(false))
  .addStringOption((option) => option.setName('category').setDescription('Category filter').setRequired(false))
  .addIntegerOption((option) => option.setName('limit').setDescription('Number of rows').setRequired(false)));

module.exports = {
  data,
  async execute(interaction) {
    await interaction.deferReply();
    const seasonId = await resolveSeasonId(interaction.options.getString('season'));
    const result = await leaderboardService.getLeaderboard(
      interaction.options.getString('type') || 'kills',
      {
        server: interaction.options.getString('server'),
        category: interaction.options.getString('category'),
        season_id: seasonId,
        limit: interaction.options.getInteger('limit') || 10
      }
    );
    await interaction.editReply({ embeds: [leaderboardEmbed(result)] });
  }
};
