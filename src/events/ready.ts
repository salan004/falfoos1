import { Events, Client } from 'discord.js';
import { t } from '../utils/i18n';
import logger from '../utils/logger';
import { startAutoPoster } from '../services/autoPoster';
import { startVoteTimer } from '../services/voteTimer';
import { initAnnouncer } from '../services/announcements';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client: Client): Promise<void> {
  logger.info(`✅ Logged in as ${client.user?.tag}`);
  logger.info(`👥 Serving ${client.guilds.cache.size} guilds`);
  logger.info(`🌐 Bot ID: ${client.user?.id}`);

  client.user?.setPresence({
    activities: [{
      name: t('presence.activity'),
      type: 3,
    }],
    status: 'online',
  });

  initAnnouncer(client);
  startAutoPoster(client);
  startVoteTimer(client);
}
