const { ChannelType } = require('discord.js');

const SENDABLE_CHANNEL_TYPES = [
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.AnnouncementThread
];

function addSendableTargetOptions(subcommand, targetLabel) {
  return subcommand
    .addChannelOption((option) => option
      .setName('channel')
      .setDescription(`${targetLabel} text channel or thread`)
      .setRequired(false)
      .addChannelTypes(...SENDABLE_CHANNEL_TYPES))
    .addStringOption((option) => option
      .setName('thread_id')
      .setDescription('Forum post/thread ID if it does not appear in the picker.')
      .setRequired(false));
}

function isSendableTarget(channel) {
  return channel && channel.isTextBased() && typeof channel.send === 'function';
}

async function resolveSendableTarget(interaction) {
  const channel = interaction.options.getChannel('channel');
  const threadId = interaction.options.getString('thread_id');
  const channelId = channel?.id || threadId;

  if (!channelId) {
    return { error: 'Pick a channel/thread or paste a forum post thread ID.' };
  }

  const resolvedChannel = channel || await interaction.client.channels.fetch(channelId).catch(() => null);
  if (!isSendableTarget(resolvedChannel)) {
    return {
      error: 'That target is not message-sendable. For forums, paste the forum post/thread ID, not the parent forum channel ID.'
    };
  }

  return { channelId, channel: resolvedChannel };
}

module.exports = {
  SENDABLE_CHANNEL_TYPES,
  addSendableTargetOptions,
  isSendableTarget,
  resolveSendableTarget
};
