const { SlashCommandBuilder } = require('discord.js');
const battlemetricsService = require('../../services/battlemetricsService');
const serverEmbed = require('../embeds/serverEmbed');
const serverService = require('../../services/serverService');
const { findServer } = require('../services/serverLookup');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverstatus')
    .setDescription('Show server status.')
    .addStringOption((option) => option.setName('server').setDescription('Server ID').setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply();
    const selected = await findServer(interaction.options.getString('server'), { enabledOnly: true });

    if (!selected) {
      await interaction.editReply('No matching enabled server is configured yet.');
      return;
    }

    const bm = await battlemetricsService.getServerStatus(selected.battlemetrics_id);
    const merged = bm
      ? { ...selected, current_status: bm.status, current_player_count: bm.playerCount, max_player_slots: bm.maxPlayers, battlemetrics_rank: bm.rank }
      : selected;
    const mods = await serverService.getServerMods(selected.server_id);
    await interaction.editReply({ embeds: [serverEmbed(merged, mods)] });
  }
};
