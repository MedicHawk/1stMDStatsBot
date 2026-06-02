const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const serverService = require('../../../services/serverService');
const { isValidCategorySlug } = require('../../../utils/validators');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('category')
    .setDescription('Manage server categories.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('list').setDescription('List categories.'))
    .addSubcommand((sub) => sub
      .setName('add')
      .setDescription('Add a category.')
      .addStringOption((option) => option.setName('slug').setDescription('Short slug such as pve').setRequired(true))
      .addStringOption((option) => option.setName('name').setDescription('Display name').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('remove')
      .setDescription('Remove an unused category.')
      .addStringOption((option) => option.setName('slug').setDescription('Category slug').setRequired(true))),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      const categories = await serverService.listCategories();
      await interaction.reply({ content: categories.map((category) => `${category.slug}: ${category.name}`).join('\n'), ephemeral: true });
      return;
    }

    if (subcommand === 'add') {
      const slug = interaction.options.getString('slug').toLowerCase();
      if (!isValidCategorySlug(slug)) {
        await interaction.reply({ content: 'Category slug must be 2-32 characters using letters, numbers, underscore, or hyphen.', ephemeral: true });
        return;
      }
      await serverService.addCategory(slug, interaction.options.getString('name'));
      await serverService.audit({ actorDiscordId: interaction.user.id, action: 'category.add', targetType: 'category', targetId: slug });
      await interaction.reply({ content: 'Category added.', ephemeral: true });
      return;
    }

    const slug = interaction.options.getString('slug').toLowerCase();
    try {
      await serverService.removeCategory(slug);
      await serverService.audit({ actorDiscordId: interaction.user.id, action: 'category.remove', targetType: 'category', targetId: slug });
      await interaction.reply({ content: 'Category removed if it existed and was unused.', ephemeral: true });
    } catch (error) {
      await interaction.reply({ content: 'Category could not be removed. Make sure no servers are using it first.', ephemeral: true });
    }
  }
};
