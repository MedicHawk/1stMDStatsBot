const { SlashCommandBuilder } = require('discord.js');
const linkService = require('../../services/linkService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink your Discord account from your Reforger player ID.'),
  async execute(interaction) {
    await linkService.unlinkDiscordUser(interaction.user.id);
    await interaction.reply({ content: 'Your account link has been removed.', ephemeral: true });
  }
};
