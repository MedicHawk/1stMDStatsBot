const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const linkService = require('../../../services/linkService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-unlink-user')
    .setDescription('Admin unlink a Discord user.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) => option.setName('user').setDescription('Discord user').setRequired(true)),
  async execute(interaction) {
    const user = interaction.options.getUser('user');
    await linkService.unlinkDiscordUser(user.id);
    await interaction.reply({ content: `Unlinked ${user.tag}.`, ephemeral: true });
  }
};
