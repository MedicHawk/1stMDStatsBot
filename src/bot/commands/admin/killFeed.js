const { ChannelType, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const serverService = require('../../../services/serverService');

function isSendableChannel(channel) {
  return channel && channel.isTextBased() && typeof channel.send === 'function';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('killfeed')
    .setDescription('Configure kill feed posting.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub
      .setName('set')
      .setDescription('Set a server kill feed channel or forum thread.')
      .addStringOption((option) => option.setName('server_id').setDescription('Server ID').setRequired(true))
      .addChannelOption((option) => option
        .setName('channel')
        .setDescription('Kill feed text channel or thread')
        .setRequired(false)
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.PublicThread,
          ChannelType.PrivateThread,
          ChannelType.AnnouncementThread
        ))
      .addStringOption((option) => option
        .setName('thread_id')
        .setDescription('Forum post/thread ID if it does not appear in the picker.')
        .setRequired(false)))
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
        const channel = interaction.options.getChannel('channel');
        const threadId = interaction.options.getString('thread_id');
        const channelId = channel?.id || threadId;

        if (!channelId) {
          await interaction.reply({ content: 'Pick a channel/thread or paste a forum post thread ID.', ephemeral: true });
          return;
        }

        const resolvedChannel = channel || await interaction.client.channels.fetch(channelId).catch(() => null);
        if (!isSendableChannel(resolvedChannel)) {
          await interaction.reply({ content: 'That target is not message-sendable. For forums, paste the forum post/thread ID, not the parent forum channel ID.', ephemeral: true });
          return;
        }

        await serverService.setKillFeedChannel(serverId, channelId);
        await serverService.audit({
          actorDiscordId: interaction.user.id,
          action: 'server.killfeed.set',
          targetType: 'server',
          targetId: serverId,
          details: { channelId }
        });
        await interaction.reply({ content: `Kill feed target set to <#${channelId}>. Use \`/killfeed enable\` to turn posting on.`, ephemeral: true });
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
