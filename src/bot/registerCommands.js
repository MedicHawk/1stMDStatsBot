require('dotenv').config();

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const commands = require('./commands');

async function register() {
  const body = commands.map((command) => command.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  if (!process.env.DISCORD_CLIENT_ID) {
    throw new Error('DISCORD_CLIENT_ID is required');
  }

  if (process.env.DISCORD_GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
      { body }
    );
    console.log(`Registered ${body.length} guild commands.`);
    return;
  }

  await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body });
  console.log(`Registered ${body.length} global commands.`);
}

register().catch((error) => {
  console.error(error);
  process.exit(1);
});
