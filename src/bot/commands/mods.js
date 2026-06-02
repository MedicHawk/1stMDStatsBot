const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const serverService = require('../../services/serverService');
const { findServer } = require('../services/serverLookup');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mods')
    .setDescription('Show installed mods for a server.')
    .addStringOption((option) => option.setName('server').setDescription('Server ID').setRequired(true)),
  async execute(interaction) {
    const selected = await findServer(interaction.options.getString('server'), { enabledOnly: false });
    if (!selected) {
      await interaction.reply({ content: 'No matching server is configured yet.', ephemeral: true });
      return;
    }

    const mods = await serverService.getServerMods(selected.server_id);
    const text = mods.length
      ? mods.map((mod) => `${mod.is_required ? 'Required' : 'Optional'}: ${mod.name} (${mod.mod_id}) ${mod.version || ''}`).join('\n').slice(0, 3900)
      : 'No mods reported yet.';
    await interaction.reply({
      embeds: [new EmbedBuilder().setTitle(`Mods for ${selected.name}`).setDescription(text).setFooter({ text: `${mods.length} total mods` })]
    });
  }
};
