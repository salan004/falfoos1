import { Client, TextChannel } from 'discord.js';
import { findGuildConfig, upsertGuildConfig, getEnabledGuildConfigs } from '../data/store';
import { fetchMeme } from '../utils/memeApi';
import { buildMemeEmbed } from '../utils/embed';
import { logAutoPost, logError } from '../utils/logger';

const intervalMap: Record<string, number> = {
  hourly: 60 * 60 * 1000,
  '3hours': 3 * 60 * 60 * 1000,
  '6hours': 6 * 60 * 60 * 1000,
  '12hours': 12 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

const activeIntervals = new Map<string, NodeJS.Timeout>();

async function postMeme(client: Client, guildId: string): Promise<void> {
  try {
    const guildConfig = findGuildConfig(guildId);
    if (!guildConfig || !guildConfig.autoPostEnabled || !guildConfig.channelId) return;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(guildConfig.channelId) as TextChannel;
    if (!channel || !channel.isTextBased()) return;

    const meme = await fetchMeme('random');

    if (!meme.imageUrl || meme.source === 'none') return;

    const embed = buildMemeEmbed(meme);

    await channel.send({ embeds: [embed] });
    logAutoPost(guildId, meme.url);

    upsertGuildConfig(guildId, { lastAutoPost: new Date() });
  } catch (error) {
    logError('Auto poster', error, { guildId });
  }
}

export function startAutoPoster(client: Client): void {
  const configs = getEnabledGuildConfigs();
  for (const config of configs) {
    scheduleGuild(client, config.guildId);
  }
}

export function scheduleGuild(client: Client, guildId: string): void {
  stopGuildSchedule(guildId);

  const config = findGuildConfig(guildId);
  if (!config || !config.autoPostEnabled) return;

  const interval = intervalMap[config.autoPostInterval] || intervalMap.hourly;
  const intervalId = setInterval(() => postMeme(client, guildId), interval);
  activeIntervals.set(guildId, intervalId);

  postMeme(client, guildId);
}

export function stopGuildSchedule(guildId: string): void {
  const existing = activeIntervals.get(guildId);
  if (existing) {
    clearInterval(existing);
    activeIntervals.delete(guildId);
  }
}

export function stopAllSchedules(): void {
  for (const [guildId, intervalId] of activeIntervals) {
    clearInterval(intervalId);
  }
  activeIntervals.clear();
}
