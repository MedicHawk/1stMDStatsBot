const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const serverService = require('../../../services/serverService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboardchannel')
    .setDescription('Configure leaderboard channel mappings.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub
      .setName('set')
      .setDescription('Set a server leaderboard channel.')
      .addStringOption((option) => option.setName('server_id').setDescription('Server ID').setRequired(true))
      .addChannelOption((option) => option.setName('channel').setDescription('Leaderboard channel').setRequired(true))),
  async execute(interaction) {
    const serverId = interaction.options.getString('server_id');
    const channel = interaction.options.getChannel('channel');
    await serverService.setLeaderboardChannel(serverId, channel.id);
    await serverService.audit({ actorDiscordId: interaction.user.id, action: 'server.leaderboardchannel.set', targetType: 'server', targetId: serverId, details: { channelId: channel.id } });
    await interaction.reply({ content: `Leaderboard channel set to ${channel}.`, ephemeral: true });
  }
};
