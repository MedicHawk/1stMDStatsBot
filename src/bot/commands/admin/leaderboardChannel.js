const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const serverService = require('../../../services/serverService');
const { addSendableTargetOptions, resolveSendableTarget } = require('../../utils/discordTargets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboardchannel')
    .setDescription('Configure leaderboard channel mappings.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => addSendableTargetOptions(
      sub
        .setName('set')
        .setDescription('Set a server leaderboard channel or thread.')
        .addStringOption((option) => option.setName('server_id').setDescription('Server ID').setRequired(true)),
      'Leaderboard'
    )),
  async execute(interaction) {
    const serverId = interaction.options.getString('server_id');
    const target = await resolveSendableTarget(interaction);
    if (target.error) {
      await interaction.reply({ content: target.error, ephemeral: true });
      return;
    }

    await serverService.setLeaderboardChannel(serverId, target.channelId);
    await serverService.audit({ actorDiscordId: interaction.user.id, action: 'server.leaderboardchannel.set', targetType: 'server', targetId: serverId, details: { channelId: target.channelId } });
    await interaction.reply({ content: `Leaderboard target set to <#${target.channelId}>.`, ephemeral: true });
  }
};
