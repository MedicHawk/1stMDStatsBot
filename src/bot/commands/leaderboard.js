const { SlashCommandBuilder } = require('discord.js');
const leaderboardService = require('../../services/leaderboardService');
const leaderboardEmbed = require('../embeds/leaderboardEmbed');
const { addSeasonOption, resolveSeasonId } = require('../services/seasonFilter');

const LEADERBOARD_CHOICES = [
  { name: 'Kills', value: 'kills' },
  { name: 'AI Kills', value: 'aikills' },
  { name: 'Deaths', value: 'deaths' },
  { name: 'Hours', value: 'hours' },
  { name: 'Revives', value: 'revives' },
  { name: 'Bandages', value: 'bandages' },
  { name: 'Tourniquets', value: 'tourniquets' },
  { name: 'Heals', value: 'heals' },
  { name: 'Treatment Amount', value: 'treatment' },
  { name: 'Repairs', value: 'repairs' },
  { name: 'Support Actions', value: 'support' },
  { name: 'Support Amount', value: 'support_amount' },
  { name: 'XP', value: 'xp' },
  { name: 'Distance', value: 'distance' }
];

const data = addSeasonOption(new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Show a filtered leaderboard.')
  .addStringOption((option) => option
    .setName('type')
    .setDescription('Leaderboard type')
    .setRequired(false)
    .addChoices(...LEADERBOARD_CHOICES))
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
