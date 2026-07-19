import { Client, EmbedBuilder, AttachmentBuilder, TextChannel } from 'discord.js';
import { getExpiredVotingMemes, getCommunityVoteStats, findGuildConfig, awardPlacements, getCommunityMemeById, checkSeasonRollover, checkAchievements, getLeaderboardByPoints, getWeeklyLeaderboard, resetWeeklyWins, getActiveVotingMemes } from '../data/store';
import { buildArenaMemeEmbed } from '../utils/embed';
import { generateLeaderboardImage } from './leaderboardImage';
import { t } from '../utils/i18n';
import { announceDailyWinners, announceVoteEndingSoon, announceWeeklyChampion, announceSeasonStart } from './announcements';
import logger from '../utils/logger';

const CHECK_INTERVAL = 60 * 1000;
const ENDING_SOON_WINDOW = 60 * 60 * 1000;
let checkTimer: NodeJS.Timeout | null = null;
let endingSoonNotified = new Set<string>();
let lastWeeklyResetDay = -1;
let lastDailyAnnouncement = '';
let clientRef: Client | null = null;

export function startVoteTimer(client: Client): void {
  clientRef = client;
  if (checkTimer) clearInterval(checkTimer);
  checkTimer = setInterval(checkVoteCycle, CHECK_INTERVAL);
  logger.info('Vote timer started (checking every 60s)');
}

export function stopVoteTimer(): void {
  if (checkTimer) { clearInterval(checkTimer); checkTimer = null; }
  logger.info('Vote timer stopped');
}

async function checkVoteCycle(): Promise<void> {
  if (!clientRef) return;

  try {
    checkSeasonRollover();

    const now = new Date();
    const today = now.getDay();

    if (today === 0 && lastWeeklyResetDay !== now.getDate()) {
      await handleWeeklyReset();
      lastWeeklyResetDay = now.getDate();
    }

    await checkEndingSoon();
    await handleExpiredVotes();

    const todayStr = now.toDateString();
    if (todayStr !== lastDailyAnnouncement && now.getHours() === 0 && now.getMinutes() < 2) {
      await handleDailyLeaderboard();
      lastDailyAnnouncement = todayStr;
    }

  } catch (error) {
    logger.error('Error in vote cycle check', { error });
  }
}

async function checkEndingSoon(): Promise<void> {
  if (!clientRef) return;
  const now = Date.now();

  for (const [, guild] of clientRef.guilds.cache) {
    const config = findGuildConfig(guild.id);
    if (!config?.memeChannelId) continue;

    const voting = getActiveVotingMemes();

    for (const meme of voting) {
      if (!meme.expiresAt) continue;
      const expiresAt = new Date(meme.expiresAt).getTime();
      const remaining = expiresAt - now;

      if (remaining > 0 && remaining <= ENDING_SOON_WINDOW && !endingSoonNotified.has(meme.id)) {
        endingSoonNotified.add(meme.id);
        await announceVoteEndingSoon(guild.id, meme.title, config.memeChannelId);
      }
    }
  }
}

async function handleExpiredVotes(): Promise<void> {
  if (!clientRef) return;

  const expired = getExpiredVotingMemes();
  if (expired.length === 0) return;

  const top3 = awardPlacements();

  if (top3.length === 0) return;

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(t('vt.round_complete.title'))
    .setTimestamp();

  const medals = ['🥇', '🥈', '🥉'];
  const description = top3.map((entry, i) => {
    const meme = entry.meme;
    const stats = getCommunityVoteStats(meme.id);
    const points = i === 0 ? t('vt.round_complete.first') : '';
    const statsStr = `😂 ${stats.funny} 🔥 ${stats.legendary} ❤️ ${stats.likes} | 📊 ${stats.score}`;
    return t('vt.round_complete.line', { medal: medals[i], userId: meme.authorId, title: meme.title || t('meme.untitled'), stats: statsStr, points });
  }).join('\n\n');

  embed.setDescription(description);

  if (top3[0]) {
    const author = top3[0].meme.authorId;
    try {
      const user = await clientRef.users.fetch(author);
      embed.setThumbnail(user.displayAvatarURL());
    } catch { }
  }

  for (const [, guild] of clientRef.guilds.cache) {
    const config = findGuildConfig(guild.id);
    if (!config?.memeChannelId) continue;

    const channel = guild.channels.cache.get(config.memeChannelId) as TextChannel;
    if (!channel?.isTextBased()) continue;

    await channel.send({ embeds: [embed] }).catch(() => {});

    const leaderboardUsers = getLeaderboardByPoints(10);
    if (leaderboardUsers.length > 0) {
      try {
        const imageBuffer = await generateLeaderboardImage(leaderboardUsers);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'leaderboard.png' });
        const lbEmbed = new EmbedBuilder()
          .setColor(0x9B59B6)
          .setTitle(t('vt.leaderboard_updated.title'))
          .setImage('attachment://leaderboard.png')
          .setTimestamp();
        await channel.send({ embeds: [lbEmbed], files: [attachment] }).catch(() => {});
      } catch (err) {
        logger.error('Failed to generate leaderboard image', { error: err });
      }
    }

    break;
  }

  for (const entry of top3) {
    const newAchievements = checkAchievements(entry.meme.authorId);
    const justUnlocked = newAchievements.filter(a => {
      const unlockedTime = a.unlockedAt ? new Date(a.unlockedAt).getTime() : 0;
      return Date.now() - unlockedTime < 5000;
    });
    for (const ach of justUnlocked) {
      if (ach.unlockedAt) {
        for (const [, guild] of clientRef.guilds.cache) {
          const config = findGuildConfig(guild.id);
          if (!config?.memeChannelId) continue;
          const channel = guild.channels.cache.get(config.memeChannelId) as TextChannel;
          if (!channel?.isTextBased()) continue;

          const achEmbed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle(t('vt.achievement.title'))
            .setDescription(t('vt.achievement.desc', { emoji: ach.emoji, userId: entry.meme.authorId, name: ach.name, description: ach.description }))
            .setTimestamp();
          await channel.send({ embeds: [achEmbed] }).catch(() => {});
        }
      }
    }
  }
}

async function handleWeeklyReset(): Promise<void> {
  const weekly = getWeeklyLeaderboard(10);
  if (weekly.length > 0) {
    for (const [, guild] of clientRef!.guilds.cache) {
      await announceWeeklyChampion(guild.id);
    }
  }
  resetWeeklyWins();
  logger.info('Weekly wins reset');
}

async function handleDailyLeaderboard(): Promise<void> {
  for (const [, guild] of clientRef!.guilds.cache) {
    const config = findGuildConfig(guild.id);
    if (!config?.memeChannelId) continue;

    const leaderboardUsers = getLeaderboardByPoints(10);
    if (leaderboardUsers.length === 0) continue;

    try {
      const imageBuffer = await generateLeaderboardImage(leaderboardUsers);
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'leaderboard.png' });
      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle(t('vt.daily_leaderboard.title'))
        .setDescription(t('vt.daily_leaderboard.desc'))
        .setImage('attachment://leaderboard.png')
        .setTimestamp();
      const channel = guild.channels.cache.get(config.memeChannelId) as TextChannel;
      if (channel?.isTextBased()) {
        await channel.send({ embeds: [embed], files: [attachment] }).catch(() => {});
      }
    } catch (err) {
      logger.error('Failed to generate daily leaderboard', { error: err });
    }
  }
}
