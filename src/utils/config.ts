import dotenv from 'dotenv';

dotenv.config();

export const config = {
  token: process.env.DISCORD_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  guildId: process.env.GUILD_ID || '',
  logLevel: process.env.LOG_LEVEL || 'info',

  get isDev(): boolean {
    return process.env.NODE_ENV !== 'production';
  },
};

if (!config.token) {
  throw new Error('DISCORD_TOKEN is required in .env file');
}

if (!config.clientId) {
  throw new Error('CLIENT_ID is required in .env file');
}
