const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const linkService = require('../../../services/linkService');
const leaderboardService = require('../../../services/leaderboardService');
const resetService = require('../../../services/resetService');
const serverService = require('../../../services/serverService');
const statsService = require('../../../services/statsService');
const { formatDuration } = require('../../embeds/leaderboardEmbed');
const { publishStatus } = require('../../services/autoPublisher');
const { addSendableTargetOptions, resolveSendableTarget } = require('../../utils/discordTargets');

const RESET_CONFIRMATION = 'RESET ALL';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('General admin utilities.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub
      .setName('unlink-user')
      .setDescription('Unlink a Discord user from their Reforger account.')
      .addUserOption((option) => option.setName('user').setDescription('Discord user').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('reset-all')
      .setDescription('Delete all configured servers and tracked stats.')
      .addStringOption((option) => option
        .setName('confirm')
        .setDescription('Type RESET ALL to confirm.')
        .setRequired(true))
      .addBooleanOption((option) => option
        .setName('keep_accounts')
        .setDescription('Keep linked player/account data while clearing servers and stats.')))
    .addSubcommand((sub) => {
      const withTarget = addSendableTargetOptions(
        sub
          .setName('say')
          .setDescription('Send a message as the bot.')
          .addStringOption((option) => option
            .setName('message')
            .setDescription('Message content.')
            .setRequired(true)
            .setMaxLength(2000)),
        'Target'
      );
      return withTarget
        .addBooleanOption((option) => option
          .setName('allow_mentions')
          .setDescription('Allow user, role, and everyone mentions in the sent message.'));
    })
    .addSubcommand((sub) => sub
      .setName('open-sessions')
      .setDescription('List currently open player sessions.')
      .addStringOption((option) => option.setName('server_id').setDescription('Optional server ID filter.').setRequired(false))
      .addIntegerOption((option) => option.setName('limit').setDescription('Max rows, default 15.').setRequired(false).setMinValue(1).setMaxValue(25)))
    .addSubcommand((sub) => sub
      .setName('close-stale-sessions')
      .setDescription('Close stale open sessions with zero duration.')
      .addStringOption((option) => option.setName('confirm').setDescription('Type CLOSE to confirm.').setRequired(true))
      .addStringOption((option) => option.setName('server_id').setDescription('Optional server ID filter.').setRequired(false))
      .addIntegerOption((option) => option.setName('older_than_minutes').setDescription('Default 60 minutes.').setRequired(false).setMinValue(1).setMaxValue(10080)))
    .addSubcommand((sub) => sub
      .setName('refresh-leaderboards')
      .setDescription('Refresh cached leaderboard payloads now.'))
    .addSubcommand((sub) => sub
      .setName('refresh-status')
      .setDescription('Refresh status embeds, status channel names, and bot presence now.')),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'unlink-user') {
      const user = interaction.options.getUser('user');
      await linkService.unlinkDiscordUser(user.id);
      await interaction.reply({ content: `Unlinked ${user.tag}.`, ephemeral: true });
      return;
    }

    if (subcommand === 'reset-all') {
      const confirmation = interaction.options.getString('confirm');
      if (confirmation !== RESET_CONFIRMATION) {
        await interaction.reply({ content: `Reset cancelled. The confirmation must be exactly \`${RESET_CONFIRMATION}\`.`, ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const keepAccounts = interaction.options.getBoolean('keep_accounts') === true;
      const deleted = await resetService.resetAll({ keepAccounts });
      await serverService.audit({
        actorDiscordId: interaction.user.id,
        action: 'admin.reset_all',
        targetType: 'database',
        targetId: 'all',
        details: { keepAccounts, deleted }
      });

      const summary = Object.entries(deleted)
        .map(([table, count]) => `${table}: ${count}`)
        .join('\n');

      await interaction.editReply({
        content: `Reset complete. Deleted rows:\n\`\`\`\n${summary}\n\`\`\``
      });
      return;
    }

    if (subcommand === 'say') {
      const target = await resolveSendableTarget(interaction);
      const message = interaction.options.getString('message');
      const allowMentions = interaction.options.getBoolean('allow_mentions') === true;

      if (target.error) {
        await interaction.reply({ content: target.error, ephemeral: true });
        return;
      }

      await target.channel.send({
        content: message,
        allowedMentions: allowMentions ? undefined : { parse: [] }
      });

      await serverService.audit({
        actorDiscordId: interaction.user.id,
        action: 'admin.say',
        targetType: 'channel',
        targetId: target.channelId,
        details: {
          messageLength: message.length,
          allowMentions
        }
      });

      await interaction.reply({ content: `Sent message to <#${target.channelId}>.`, ephemeral: true });
      return;
    }

    if (subcommand === 'open-sessions') {
      await interaction.deferReply({ ephemeral: true });
      const rows = await statsService.listOpenSessions({
        serverId: interaction.options.getString('server_id'),
        limit: interaction.options.getInteger('limit') || 15
      });
      const text = rows.length
        ? rows.map((row) => {
            const player = row.display_name || row.reforger_player_id;
            return `${row.server_id} | ${player} | ${formatDuration(row.elapsed_seconds || 0)}`;
          }).join('\n')
        : 'No open sessions found.';
      await interaction.editReply({ content: `Open sessions:\n\`\`\`\n${text.slice(0, 1900)}\n\`\`\`` });
      return;
    }

    if (subcommand === 'close-stale-sessions') {
      const confirmation = interaction.options.getString('confirm');
      if (confirmation !== 'CLOSE') {
        await interaction.reply({ content: 'Cleanup cancelled. The confirmation must be exactly `CLOSE`.', ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      const serverId = interaction.options.getString('server_id');
      const olderThanMinutes = interaction.options.getInteger('older_than_minutes') || 60;
      const closed = await statsService.closeStaleOpenSessions({ serverId, olderThanMinutes });
      await serverService.audit({
        actorDiscordId: interaction.user.id,
        action: 'admin.close_stale_sessions',
        targetType: 'sessions',
        targetId: serverId || 'all',
        details: { closed, olderThanMinutes }
      });
      await interaction.editReply({ content: `Closed ${closed} stale open session(s).` });
      return;
    }

    if (subcommand === 'refresh-leaderboards') {
      await interaction.deferReply({ ephemeral: true });
      const count = await leaderboardService.refreshDefaultLeaderboards();
      await serverService.audit({
        actorDiscordId: interaction.user.id,
        action: 'admin.refresh_leaderboards',
        targetType: 'leaderboards',
        targetId: 'default',
        details: { count }
      });
      await interaction.editReply({ content: `Refreshed ${count} leaderboard cache payload(s).` });
      return;
    }

    if (subcommand === 'refresh-status') {
      await interaction.deferReply({ ephemeral: true });
      await publishStatus(interaction.client);
      await serverService.audit({
        actorDiscordId: interaction.user.id,
        action: 'admin.refresh_status',
        targetType: 'status',
        targetId: 'all'
      });
      await interaction.editReply({ content: 'Refreshed status embeds, channel names, and bot presence.' });
    }
  }
};
