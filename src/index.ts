import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from './utils/config';
import logger from './utils/logger';
import { stopAllSchedules } from './services/autoPoster';
import { stopVoteTimer } from './services/voteTimer';
import { initDataStore } from './data/store';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();
client.cooldowns = new Collection();

async function loadCommands(): Promise<void> {
  const commandFiles = [
    './commands/meme',
    './commands/arena',
    './commands/favorites',
    './commands/myfavorites',
    './commands/leaderboard',
    './commands/submit',
    './commands/profile',
    './commands/mymemes',
    './commands/stats',
    './commands/help',
    './commands/pending-memes',
    './commands/mystats',
    './commands/topmemes',
    './commands/topcreators',
    './commands/config/index',
  ];

  for (const filePath of commandFiles) {
    try {
      const command = await import(filePath);
      if (command.data && command.execute) {
        client.commands.set(command.data.name, command);
        logger.info(`Loaded command: /${command.data.name}`);
      }
    } catch (error) {
      logger.error(`Failed to load command from ${filePath}`, { error });
    }
  }
}

async function loadEvents(): Promise<void> {
  const eventFiles = [
    './events/ready',
    './events/interactionCreate',
  ];

  for (const filePath of eventFiles) {
    try {
      const event = await import(filePath);
      if (event.name) {
        if (event.once) {
          client.once(event.name, (...args: any[]) => event.execute(...args));
        } else {
          client.on(event.name, (...args: any[]) => event.execute(...args));
        }
        logger.info(`Loaded event: ${event.name}`);
      }
    } catch (error) {
      logger.error(`Failed to load event from ${filePath}`, { error });
    }
  }
}

async function start(): Promise<void> {
  try {
    logger.info('Initializing data store...');
    initDataStore();
    logger.info('✅ Data store initialized');

    logger.info('Loading commands...');
    await loadCommands();

    logger.info('Loading events...');
    await loadEvents();

    logger.info('Logging in to Discord...');
    await client.login(config.token);
  } catch (error) {
    logger.error('Failed to start bot', { error });
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  stopAllSchedules();
  stopVoteTimer();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...');
  stopAllSchedules();
  stopVoteTimer();
  client.destroy();
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection', { error });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
});

start();
