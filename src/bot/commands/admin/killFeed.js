const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const serverService = require('../../../services/serverService');
const { addSendableTargetOptions, resolveSendableTarget } = require('../../utils/discordTargets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('killfeed')
    .setDescription('Configure kill feed posting.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => addSendableTargetOptions(
      sub
        .setName('set')
        .setDescription('Set a server kill feed channel or thread.')
        .addStringOption((option) => option.setName('server_id').setDescription('Server ID').setRequired(true)),
      'Kill feed'
    ))
    .addSubcommand((sub) => sub
      .setName('enable')
      .setDescription('Turn on kill feed posting for a server.')
      .addStringOption((option) => option.setName('server_id').setDescription('Server ID').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('disable')
      .setDescription('Turn off kill feed posting for a server.')
      .addStringOption((option) => option.setName('server_id').setDescription('Server ID').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('status')
      .setDescription('Show kill feed settings for a server.')
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

        await serverService.setKillFeedChannel(serverId, target.channelId);
        await serverService.audit({
          actorDiscordId: interaction.user.id,
          action: 'server.killfeed.set',
          targetType: 'server',
          targetId: serverId,
          details: { channelId: target.channelId }
        });
        await interaction.reply({ content: `Kill feed target set to <#${target.channelId}>. Use \`/killfeed enable\` to turn posting on.`, ephemeral: true });
        return;
      }

      if (subcommand === 'enable' || subcommand === 'disable') {
        const enabled = subcommand === 'enable';
        await serverService.setKillFeedEnabled(serverId, enabled);
        await serverService.audit({
          actorDiscordId: interaction.user.id,
          action: `server.killfeed.${subcommand}`,
          targetType: 'server',
          targetId: serverId
        });
        await interaction.reply({ content: `Kill feed ${enabled ? 'enabled' : 'disabled'} for \`${serverId}\`.`, ephemeral: true });
        return;
      }

      const servers = await serverService.listServers();
      const server = servers.find((row) => row.server_id === serverId);
      if (!server) {
        await interaction.reply({ content: 'Server not found.', ephemeral: true });
        return;
      }

      await interaction.reply({
        content: `Kill feed for \`${serverId}\`: ${server.kill_feed_enabled ? 'enabled' : 'disabled'}${server.kill_feed_channel_id ? ` in <#${server.kill_feed_channel_id}>` : ', no channel set'}.`,
        ephemeral: true
      });
    } catch (error) {
      await interaction.reply({ content: error.message || 'Could not update kill feed settings.', ephemeral: true });
    }
  }
};
