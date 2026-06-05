const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const serverService = require('../../../services/serverService');

function withTrailingSlash(value) {
  if (!value) {
    return 'http://localhost:3000/';
  }

  return value.endsWith('/') ? value : `${value}/`;
}

function buildRuntimeConfig({ serverId, apiKey, apiBaseUrl, scenarioName, maxPlayerSlots }) {
  return {
    enabled: true,
    api_base_url: withTrailingSlash(apiBaseUrl),
    server_id: serverId,
    api_key: apiKey,
    movement_sample_seconds: 10,
    heartbeat_seconds: 30,
    queue_flush_seconds: 15,
    telemetry_log_seconds: 60,
    scenario_name: scenarioName || 'unknown',
    max_player_slots: maxPlayerSlots ?? 64
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Manage tracked Arma Reforger servers.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('list').setDescription('List configured servers.'))
    .addSubcommand((sub) => sub
      .setName('add')
      .setDescription('Add a server.')
      .addStringOption((option) => option.setName('server_id').setDescription('Stable internal server ID').setRequired(true))
      .addStringOption((option) => option.setName('name').setDescription('Display name').setRequired(true))
      .addStringOption((option) => option.setName('category').setDescription('Category slug').setRequired(true))
      .addStringOption((option) => option.setName('api_key').setDescription('Per-server API key').setRequired(true))
      .addStringOption((option) => option.setName('battlemetrics_id').setDescription('BattleMetrics server ID').setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('enable')
      .setDescription('Enable a server.')
      .addStringOption((option) => option.setName('server_id').setDescription('Server ID').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('disable')
      .setDescription('Disable a server.')
      .addStringOption((option) => option.setName('server_id').setDescription('Server ID').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('remove')
      .setDescription('Remove a configured server.')
      .addStringOption((option) => option.setName('server_id').setDescription('Server ID').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('rotate-key')
      .setDescription('Generate and store a new API key for a server.')
      .addStringOption((option) => option.setName('server_id').setDescription('Server ID').setRequired(true))
      .addStringOption((option) => option.setName('confirm').setDescription('Type ROTATE to confirm.').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('config')
      .setDescription('Generate a paste-ready Reforger runtime config, creating the server if needed.')
      .addStringOption((option) => option.setName('server_id').setDescription('Server ID').setRequired(true))
      .addStringOption((option) => option.setName('confirm').setDescription('Type GENERATE to rotate the key and generate config.').setRequired(true))
      .addStringOption((option) => option.setName('api_base_url').setDescription('Public API URL. Defaults to PUBLIC_API_URL.').setRequired(false))
      .addStringOption((option) => option.setName('scenario_name').setDescription('Scenario/map label to report.').setRequired(false))
      .addIntegerOption((option) => option.setName('max_player_slots').setDescription('Configured max player slots.').setRequired(false).setMinValue(0).setMaxValue(256))
      .addStringOption((option) => option.setName('name').setDescription('Display name if the server must be created.').setRequired(false))
      .addStringOption((option) => option.setName('category').setDescription('Category slug if the server must be created. Defaults to pve.').setRequired(false))
      .addStringOption((option) => option.setName('battlemetrics_id').setDescription('BattleMetrics server ID if the server must be created.').setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('edit')
      .setDescription('Edit a server.')
      .addStringOption((option) => option.setName('server_id').setDescription('Server ID').setRequired(true))
      .addStringOption((option) => option.setName('name').setDescription('New display name').setRequired(false))
      .addStringOption((option) => option.setName('category').setDescription('New category slug').setRequired(false))
      .addStringOption((option) => option.setName('battlemetrics_id').setDescription('New BattleMetrics server ID').setRequired(false)))
    .addSubcommandGroup((group) => group
      .setName('category')
      .setDescription('Set server category.')
      .addSubcommand((sub) => sub
        .setName('set')
        .setDescription('Change a server category.')
        .addStringOption((option) => option.setName('server_id').setDescription('Server ID').setRequired(true))
        .addStringOption((option) => option.setName('category').setDescription('Category slug').setRequired(true)))),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);

    if (subcommand === 'list') {
      const servers = await serverService.listServers();
      const text = servers.length
        ? servers.map((server) => `${server.enabled ? 'on' : 'off'} ${server.server_id}: ${server.name} [${server.category}]`).join('\n')
        : 'No servers configured.';
      await interaction.reply({ content: text, ephemeral: true });
      return;
    }

    if (subcommand === 'add') {
      try {
        await serverService.addServer({
          serverId: interaction.options.getString('server_id'),
          name: interaction.options.getString('name'),
          category: interaction.options.getString('category'),
          apiKey: interaction.options.getString('api_key'),
          battlemetricsId: interaction.options.getString('battlemetrics_id')
        });
        await serverService.audit({ actorDiscordId: interaction.user.id, action: 'server.add', targetType: 'server', targetId: interaction.options.getString('server_id') });
        await interaction.reply({ content: 'Server added. Store the API key safely; it is now hashed in the database.', ephemeral: true });
      } catch (error) {
        await interaction.reply({ content: error.message || 'Could not add server.', ephemeral: true });
      }
      return;
    }

    if (subcommand === 'enable' || subcommand === 'disable') {
      const serverId = interaction.options.getString('server_id');
      try {
        await serverService.setServerEnabled(serverId, subcommand === 'enable');
        await serverService.audit({ actorDiscordId: interaction.user.id, action: `server.${subcommand}`, targetType: 'server', targetId: serverId });
        await interaction.reply({ content: `Server ${subcommand}d.`, ephemeral: true });
      } catch (error) {
        await interaction.reply({ content: error.message || `Could not ${subcommand} server.`, ephemeral: true });
      }
      return;
    }

    if (subcommand === 'remove') {
      const serverId = interaction.options.getString('server_id');
      try {
        await serverService.removeServer(serverId);
        await serverService.audit({ actorDiscordId: interaction.user.id, action: 'server.remove', targetType: 'server', targetId: serverId });
        await interaction.reply({ content: 'Server removed.', ephemeral: true });
      } catch (error) {
        await interaction.reply({ content: error.message || 'Could not remove server.', ephemeral: true });
      }
      return;
    }

    if (subcommand === 'rotate-key') {
      const serverId = interaction.options.getString('server_id');
      const confirmation = interaction.options.getString('confirm');

      if (confirmation !== 'ROTATE') {
        await interaction.reply({ content: 'Key rotation cancelled. The confirmation must be exactly `ROTATE`.', ephemeral: true });
        return;
      }

      try {
        const apiKey = await serverService.rotateServerApiKey(serverId);
        await serverService.audit({ actorDiscordId: interaction.user.id, action: 'server.rotate_key', targetType: 'server', targetId: serverId });
        await interaction.reply({
          content: `New API key for \`${serverId}\`:\n\`\`\`\n${apiKey}\n\`\`\`\nStore it now. It is shown once and only the hash is saved.`,
          ephemeral: true
        });
      } catch (error) {
        await interaction.reply({ content: error.message || 'Could not rotate server API key.', ephemeral: true });
      }
      return;
    }

    if (subcommand === 'config') {
      const serverId = interaction.options.getString('server_id');
      const confirmation = interaction.options.getString('confirm');

      if (confirmation !== 'GENERATE') {
        await interaction.reply({ content: 'Config generation cancelled. The confirmation must be exactly `GENERATE`.', ephemeral: true });
        return;
      }

      try {
        let created = false;
        let apiKey;

        try {
          apiKey = await serverService.rotateServerApiKey(serverId);
        } catch (error) {
          if (error.message !== 'Server not found') {
            throw error;
          }

          created = true;
          apiKey = await serverService.addServerWithGeneratedApiKey({
            serverId,
            name: interaction.options.getString('name') || serverId,
            category: interaction.options.getString('category') || 'pve',
            battlemetricsId: interaction.options.getString('battlemetrics_id')
          });
        }

        const apiBaseUrl = interaction.options.getString('api_base_url') || process.env.PUBLIC_API_URL || 'http://localhost:3000/';
        const scenarioName = interaction.options.getString('scenario_name') || 'unknown';
        const maxPlayerSlots = interaction.options.getInteger('max_player_slots') ?? 64;
        const config = buildRuntimeConfig({ serverId, apiKey, apiBaseUrl, scenarioName, maxPlayerSlots });

        await serverService.audit({
          actorDiscordId: interaction.user.id,
          action: 'server.generate_config',
          targetType: 'server',
          targetId: serverId,
          details: {
            created,
            apiBaseUrl: config.api_base_url,
            scenarioName: config.scenario_name,
            maxPlayerSlots: config.max_player_slots
          }
        });

        await interaction.reply({
          content: `${created ? 'Server created. ' : ''}Paste this into \`$profile:MDST_StatsBot_Config.json\` for \`${serverId}\`:\n\`\`\`json\n${JSON.stringify(config, null, 2)}\n\`\`\`\nThis generated a new API key${created ? '.' : ' and invalidated the previous one.'}`,
          ephemeral: true
        });
      } catch (error) {
        await interaction.reply({ content: error.message || 'Could not generate server config.', ephemeral: true });
      }
      return;
    }

    if (subcommand === 'edit') {
      const serverId = interaction.options.getString('server_id');
      const details = {
          name: interaction.options.getString('name'),
          category: interaction.options.getString('category'),
          battlemetricsId: interaction.options.getString('battlemetrics_id')
      };
      try {
        await serverService.editServer(serverId, details);
        await serverService.audit({
          actorDiscordId: interaction.user.id,
          action: 'server.edit',
          targetType: 'server',
          targetId: serverId,
          details
        });
        await interaction.reply({ content: 'Server updated.', ephemeral: true });
      } catch (error) {
        await interaction.reply({ content: error.message || 'Could not update server.', ephemeral: true });
      }
      return;
    }

    if (group === 'category' && subcommand === 'set') {
      const serverId = interaction.options.getString('server_id');
      const category = interaction.options.getString('category');
      try {
        await serverService.setServerCategory(serverId, category);
        await serverService.audit({ actorDiscordId: interaction.user.id, action: 'server.category.set', targetType: 'server', targetId: serverId, details: { category } });
        await interaction.reply({ content: 'Server category updated.', ephemeral: true });
      } catch (error) {
        await interaction.reply({ content: error.message || 'Could not update server category.', ephemeral: true });
      }
    }
  }
};
