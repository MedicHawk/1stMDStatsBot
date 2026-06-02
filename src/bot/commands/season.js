const { PermissionFlagsBits, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const seasonService = require('../../services/seasonService');
const serverService = require('../../services/serverService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('season')
    .setDescription('View or manage seasons.')
    .addSubcommand((sub) => sub.setName('current').setDescription('Show the current season.'))
    .addSubcommand((sub) => sub.setName('list').setDescription('List recent seasons.'))
    .addSubcommand((sub) => sub
      .setName('create')
      .setDescription('Create a season.')
      .addStringOption((option) => option.setName('name').setDescription('Season name').setRequired(true))
      .addStringOption((option) => option.setName('starts_at').setDescription('MySQL datetime or ISO timestamp').setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('close')
      .setDescription('Close a season by database ID.')
      .addIntegerOption((option) => option.setName('id').setDescription('Season ID').setRequired(true))),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if ((subcommand === 'create' || subcommand === 'close') && !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: 'You need Manage Server permission to manage seasons.', ephemeral: true });
      return;
    }

    if (subcommand === 'create') {
      const name = interaction.options.getString('name');
      const startsAt = interaction.options.getString('starts_at') || new Date().toISOString().slice(0, 19).replace('T', ' ');
      await seasonService.createSeason(
        name,
        startsAt
      );
      await serverService.audit({ actorDiscordId: interaction.user.id, action: 'season.create', targetType: 'season', targetId: name, details: { startsAt } });
      await interaction.reply({ content: 'Season created.', ephemeral: true });
      return;
    }

    if (subcommand === 'close') {
      const id = interaction.options.getInteger('id');
      await seasonService.closeSeason(id);
      await serverService.audit({ actorDiscordId: interaction.user.id, action: 'season.close', targetType: 'season', targetId: String(id) });
      await interaction.reply({ content: 'Season closed.', ephemeral: true });
      return;
    }

    if (subcommand === 'list') {
      const seasons = await seasonService.listSeasons();
      const description = seasons.length
        ? seasons.map((season) => `**${season.id}.** ${season.name} - ${season.is_active ? 'active' : 'closed'} - starts ${season.starts_at}`).join('\n')
        : 'No seasons created yet.';
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle('Seasons').setDescription(description)], ephemeral: true });
      return;
    }

    const season = await seasonService.getCurrentSeason();
    const embed = season
      ? new EmbedBuilder().setTitle(season.name).setDescription(`Started: ${season.starts_at}`)
      : new EmbedBuilder().setTitle('No active season').setDescription('An admin can create one with `/season create`.');
    await interaction.reply({ embeds: [embed] });
  }
};
