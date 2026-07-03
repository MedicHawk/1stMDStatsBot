const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const serverService = require('../../../services/serverService');
const { addSendableTargetOptions, resolveSendableTarget } = require('../../utils/discordTargets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('supportfeed')
    .setDescription('Configure medical and support event posting.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => addSendableTargetOptions(
      sub
        .setName('set')
        .setDescription('Set a server medical/support feed channel or thread.')
        .addStringOption((option) => option.setName('server_id').setDescription('Server ID').setRequired(true)),
      'Support feed'
    ))
    .addSubcommand((sub) => sub
      .setName('enable')
      .setDescription('Turn on medical/support feed posting for a server.')
      .addStringOption((option) => option.setName('server_id').setDescription('Server ID').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('disable')
      .setDescription('Turn off medical/support feed posting for a server.')
      .addStringOption((option) => option.setName('server_id').setDescription('Server ID').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('status')
      .setDescription('Show medical/support feed settings for a server.')
      .addStringOption((option) => option.setName('server_id').setDescription('Server ID').setRequired(true))),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const serverId = interaction.options.getString('server_id');

    try {
      if (subcommand === 'set') {
        const target = await resolveSendableTarget(interaction);
        if (target.error) {
          await interaction.reply({ content: target.error, ephemeral: true });
          return;
        }

        await serverService.setSupportFeedChannel(serverId, target.channelId);
        await serverService.audit({
          actorDiscordId: interaction.user.id,
          action: 'server.supportfeed.set',
          targetType: 'server',
          targetId: serverId,
          details: { channelId: target.channelId }
        });
        await interaction.reply({ content: `Medical/support feed target set to <#${target.channelId}>. Use \`/supportfeed enable\` to turn posting on.`, ephemeral: true });
        return;
      }

      if (subcommand === 'enable' || subcommand === 'disable') {
        const enabled = subcommand === 'enable';
        await serverService.setSupportFeedEnabled(serverId, enabled);
        await serverService.audit({
          actorDiscordId: interaction.user.id,
          action: `server.supportfeed.${subcommand}`,
          targetType: 'server',
          targetId: serverId
        });
        await interaction.reply({ content: `Medical/support feed ${enabled ? 'enabled' : 'disabled'} for \`${serverId}\`.`, ephemeral: true });
        return;
      }

      const servers = await serverService.listServers();
      const server = servers.find((row) => row.server_id === serverId);
      if (!server) {
        await interaction.reply({ content: 'Server not found.', ephemeral: true });
        return;
      }

      await interaction.reply({
        content: `Medical/support feed for \`${serverId}\`: ${server.support_feed_enabled ? 'enabled' : 'disabled'}${server.support_feed_channel_id ? ` in <#${server.support_feed_channel_id}>` : ', no channel set'}.`,
        ephemeral: true
      });
    } catch (error) {
      await interaction.reply({ content: error.message || 'Could not update medical/support feed settings.', ephemeral: true });
    }
  }
};
