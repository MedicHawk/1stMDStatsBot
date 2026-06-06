const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const serverService = require('../../../services/serverService');
const { addSendableTargetOptions, resolveSendableTarget } = require('../../utils/discordTargets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('statuschannel')
    .setDescription('Configure status channel mappings.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => addSendableTargetOptions(
      sub
        .setName('set')
        .setDescription('Set a server status channel or thread.')
        .addStringOption((option) => option.setName('server_id').setDescription('Server ID').setRequired(true)),
      'Status'
    )),
  async execute(interaction) {
    const serverId = interaction.options.getString('server_id');
    const target = await resolveSendableTarget(interaction);
    if (target.error) {
      await interaction.reply({ content: target.error, ephemeral: true });
      return;
    }

    await serverService.setStatusChannel(serverId, target.channelId);
    await serverService.audit({ actorDiscordId: interaction.user.id, action: 'server.statuschannel.set', targetType: 'server', targetId: serverId, details: { channelId: target.channelId } });
    await interaction.reply({ content: `Status target set to <#${target.channelId}>.`, ephemeral: true });
  }
};
