const { SlashCommandBuilder } = require('discord.js');
const linkService = require('../../services/linkService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Generate a one-time code to link your Discord account in-game.'),
  async execute(interaction) {
    const { code, expiresInMinutes } = await linkService.createLinkCode(interaction.user.id);
    await interaction.reply({
      content: `Your link code is \`${code}\`. Enter it in-game within ${expiresInMinutes} minutes.`,
      ephemeral: true
    });
  }
};
