const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const serverService = require('../../../services/serverService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('statuschannel')
    .setDescription('Configure status channel mappings.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub
      .setName('set')
      .setDescription('Set a server status channel.')
      .addStringOption((option) => option.setName('server_id').setDescription('Server ID').setRequired(true))
      .addChannelOption((option) => option.setName('channel').setDescription('Status channel').setRequired(true))),
  async execute(interaction) {
    const serverId = interaction.options.getString('server_id');
    const channel = interaction.options.getChannel('channel');
    await serverService.setStatusChannel(serverId, channel.id);
    await serverService.audit({ actorDiscordId: interaction.user.id, action: 'server.statuschannel.set', targetType: 'server', targetId: serverId, details: { channelId: channel.id } });
    await interaction.reply({ content: `Status channel set to ${channel}.`, ephemeral: true });
  }
};
