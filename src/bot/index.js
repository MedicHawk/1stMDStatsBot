require('dotenv').config();

const { Client, Collection, GatewayIntentBits } = require('discord.js');
const logger = require('../utils/logger');
const commands = require('./commands');
const { startAutoPublisher } = require('./services/autoPublisher');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.commands = new Collection();
for (const command of commands) {
  client.commands.set(command.data.name, command);
}

client.once('clientReady', () => {
  logger.info({ tag: client.user.tag, commands: client.commands.size }, 'Discord bot ready');
  startAutoPublisher(client);
});

client.on('interactionCreate', require('./events/interactionCreate'));

if (!process.env.DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN is required');
}

client.login(process.env.DISCORD_TOKEN);
