const { SlashCommandBuilder } = require('discord.js');
const linkService = require('../../services/linkService');
const profileEmbed = require('../embeds/profileEmbed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Show a linked Reforger profile.')
    .addUserOption((option) => option.setName('user').setDescription('Discord user').setRequired(false)),
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const profile = await linkService.getProfileByDiscordId(user.id);
    await interaction.reply({ embeds: [profileEmbed(profile)] });
  }
};
