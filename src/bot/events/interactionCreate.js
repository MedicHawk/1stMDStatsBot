const logger = require('../../utils/logger');

module.exports = async function interactionCreate(interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error({ error, command: interaction.commandName }, 'Command failed');
    const payload = {
      content: 'Something went wrong while running that command.',
      ephemeral: true
    };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply(payload);
    }
  }
};
