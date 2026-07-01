import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { findGuildConfig, getActiveSeason, getWeeklyLeaderboard } from '../data/store';
import { t } from '../utils/i18n';
import logger from '../utils/logger';

let clientRef: Client | null = null;

export function initAnnouncer(client: Client): void {
  clientRef = client;
}

export async function announceToGuild(
  guildId: string,
  embed: EmbedBuilder,
  channelType: 'memeChannelId' | 'announcementChannelId' | 'channelId',
): Promise<void> {
  if (!clientRef) return;
  try {
    const config = findGuildConfig(guildId);
    const channelId = config?.[channelType];
    if (!channelId) return;

    const guild = clientRef.guilds.cache.get(guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(channelId) as TextChannel;
    if (!channel?.isTextBased()) return;

    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error(`Announcement failed for guild ${guildId}`, { error });
  }
}

export async function announceVoteStart(guildId: string, memeTitle: string, authorId: string): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(t('anno.vote_start.title'))
    .setDescription(t('anno.vote_start.desc', { title: memeTitle || t('meme.untitled'), authorId }))
    .addFields({ name: t('anno.vote_start.duration'), value: t('anno.vote_start.duration_val'), inline: true })
    .setTimestamp();

  await announceToGuild(guildId, embed, 'memeChannelId');
}

export async function announceVoteEndingSoon(guildId: string, memeTitle: string, channelId: string): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0xF39C12)
    .setTitle(t('anno.vote_ending.title'))
    .setDescription(t('anno.vote_ending.desc', { title: memeTitle || t('meme.untitled'), channelId }))
    .setTimestamp();

  await announceToGuild(guildId, embed, 'memeChannelId');
}

export async function announceDailyWinners(guildId: string, topEntries: { userId: string; memeTitle: string; score: number }[]): Promise<void> {
  if (topEntries.length === 0) return;

  const medals = ['🥇', '🥈', '🥉'];
  const description = topEntries.map((e, i) =>
    `${medals[i] || `#${i + 1}`} <@${e.userId}> — **${e.memeTitle || t('meme.untitled')}** — 📊 ${e.score}`
  ).join('\n');

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(t('anno.daily_winners.title'))
    .setDescription(description)
    .addFields(
      { name: t('anno.daily_winners.first_place'), value: t('anno.daily_winners.prize'), inline: true },
    )
    .setTimestamp();

  await announceToGuild(guildId, embed, 'memeChannelId');
}

export async function announceWeeklyChampion(guildId: string): Promise<void> {
  const weekly = getWeeklyLeaderboard(1);
  if (weekly.length === 0) return;

  const champion = weekly[0];
  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(t('anno.weekly_champion.title'))
    .setDescription(t('anno.weekly_champion.desc', { userId: champion.userId, wins: champion.weeklyWins }))
    .setTimestamp();

  await announceToGuild(guildId, embed, 'memeChannelId');
}

export async function announceMilestone(guildId: string, userId: string, achievement: string): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(t('anno.milestone.title'))
    .setDescription(t('anno.milestone.desc', { userId, achievement }))
    .setTimestamp();

  await announceToGuild(guildId, embed, 'memeChannelId');
}

export async function announceSeasonStart(guildId: string): Promise<void> {
  const season = getActiveSeason();
  if (!season) return;

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(t('anno.season_start.title'))
    .setDescription(t('anno.season_start.desc', { name: season.name }))
    .addFields(
      { name: t('anno.season_start.ends'), value: new Date(season.endDate).toLocaleDateString('ar-SA'), inline: true },
      { name: t('anno.season_start.reward'), value: t('anno.season_start.reward_val'), inline: true },
    )
    .setTimestamp();

  await announceToGuild(guildId, embed, 'memeChannelId');
}
