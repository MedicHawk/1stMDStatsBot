const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const linkService = require('../../../services/linkService');
const resetService = require('../../../services/resetService');
const serverService = require('../../../services/serverService');

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
    .addSubcommand((sub) => sub
      .setName('say')
      .setDescription('Send a message as the bot.')
      .addChannelOption((option) => option
        .setName('channel')
        .setDescription('Channel to send the message to.')
        .setRequired(true))
      .addStringOption((option) => option
        .setName('message')
        .setDescription('Message content.')
        .setRequired(true)
        .setMaxLength(2000))
      .addBooleanOption((option) => option
        .setName('allow_mentions')
        .setDescription('Allow user, role, and everyone mentions in the sent message.'))),
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
      const channel = interaction.options.getChannel('channel');
      const message = interaction.options.getString('message');
      const allowMentions = interaction.options.getBoolean('allow_mentions') === true;

      if (!channel || !channel.isTextBased() || typeof channel.send !== 'function') {
        await interaction.reply({ content: 'That channel cannot receive bot messages.', ephemeral: true });
        return;
      }

      await channel.send({
        content: message,
        allowedMentions: allowMentions ? undefined : { parse: [] }
      });

      await serverService.audit({
        actorDiscordId: interaction.user.id,
        action: 'admin.say',
        targetType: 'channel',
        targetId: channel.id,
        details: {
          messageLength: message.length,
          allowMentions
        }
      });

      await interaction.reply({ content: `Sent message to ${channel}.`, ephemeral: true });
    }
  }
};
