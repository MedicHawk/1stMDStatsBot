const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const statsService = require('../../../services/statsService');
const serverService = require('../../../services/serverService');

const STAT_CHOICES = [
  ['Player kills', 'player_kills'],
  ['AI kills', 'ai_kills'],
  ['Deaths', 'deaths'],
  ['Teamkills', 'teamkills'],
  ['Assists', 'assists'],
  ['Shots fired', 'shots_fired'],
  ['Hits', 'hits']
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats-adjust')
    .setDescription('Audited manual stat adjustments.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) => option.setName('server_id').setDescription('Server ID').setRequired(true))
    .addStringOption((option) => option.setName('player_reforger_id').setDescription('Stable Reforger player ID').setRequired(true))
    .addStringOption((option) => {
      option.setName('stat').setDescription('Stat to adjust').setRequired(true);
      for (const [name, value] of STAT_CHOICES) option.addChoices({ name, value });
      return option;
    })
    .addIntegerOption((option) => option.setName('delta').setDescription('Positive or negative adjustment').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Audit reason').setRequired(true))
    .addIntegerOption((option) => option.setName('season_id').setDescription('Season ID, omit for all-time').setRequired(false))
    .addStringOption((option) => option.setName('player_name').setDescription('Optional display name').setRequired(false)),
  async execute(interaction) {
    const serverId = interaction.options.getString('server_id');
    const reforgerPlayerId = interaction.options.getString('player_reforger_id');
    const stat = interaction.options.getString('stat');
    const delta = interaction.options.getInteger('delta');
    const reason = interaction.options.getString('reason');
    const seasonId = interaction.options.getInteger('season_id');
    const displayName = interaction.options.getString('player_name');

    await statsService.adjustPlayerStat({
      serverId,
      reforgerPlayerId,
      displayName,
      seasonId,
      stat,
      delta
    });
    await serverService.audit({
      actorDiscordId: interaction.user.id,
      action: 'stats.adjust',
      targetType: 'player',
      targetId: reforgerPlayerId,
      details: { serverId, seasonId, stat, delta, reason }
    });
    await interaction.reply({ content: `Adjusted ${stat} by ${delta} for ${reforgerPlayerId}.`, ephemeral: true });
  }
};
