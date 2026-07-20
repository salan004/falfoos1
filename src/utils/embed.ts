import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } from 'discord.js';
import fetch from 'node-fetch';
import { MemeData, CommunityMeme, UserProfile } from '../types';
import { t } from './i18n';
import { getCommunityVoteStats } from '../data/store';

function sourceLabel(sourceType: string): string {
  return t(`embed.source.${sourceType}`);
}

export function isVideoUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith('.mp4') || pathname.endsWith('.mov') || pathname.endsWith('.webm');
  } catch {
    return false;
  }
}

export function getExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('.');
    if (parts.length > 1) {
      const ext = parts[parts.length - 1].toLowerCase();
      if (['mp4', 'mov', 'webm', 'png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return ext;
    }
  } catch { }
  return 'mp4';
}

export async function fetchVideoBuffer(url: string, label: string = 'unknown'): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    console.log(`[fetchVideoBuffer:${label}]`, {
      url: url.slice(0, 120),
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
    });
    if (!response.ok) {
      console.error(`[fetchVideoBuffer:${label}] HTTP ${response.status} for ${url.slice(0, 80)}`);
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0) {
      console.error(`[fetchVideoBuffer:${label}] Empty buffer`);
      return null;
    }
    console.log(`[fetchVideoBuffer:${label}] buffer size: ${buffer.length}`);
    return buffer;
  } catch (err) {
    console.error(`[fetchVideoBuffer:${label}] Network error:`, err);
    return null;
  }
}

export function buildMemeEmbed(meme: MemeData, requesterName?: string): EmbedBuilder {
  const categoryEmojis: Record<string, string> = { arabic: '🌍', gaming: '🎮', discord: '💬', school: '📚', internet: '🌐', random: '🎲' };
  const emoji = categoryEmojis[meme.category] || '🎭';
  const srcLabel = sourceLabel(meme.sourceType);
  let footerText = `${srcLabel} • ${t('footer.source', { source: meme.source })}`;
  if (requesterName) footerText += t('footer.requested', { user: requesterName });
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6).setTitle(`${emoji} ${meme.title}`).setURL(meme.url)
    .setFooter({ text: footerText }).setTimestamp();
  embed.setImage(meme.imageUrl);
  if (meme.author) embed.setAuthor({ name: t('footer.author', { author: meme.author }) });
  return embed;
}

export function buildArenaMemeEmbed(meme: CommunityMeme): EmbedBuilder {
  const categoryEmojis: Record<string, string> = { arabic: '🌍', gaming: '🎮', discord: '💬', school: '📚', internet: '🌐', random: '🎲' };
  const emoji = categoryEmojis[meme.category] || '🎭';
  const stats = getCommunityVoteStats(meme.id);
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6).setTitle(`${emoji} ${meme.title || t('footer.community')}`)
    .addFields(
      { name: '👤', value: `<@${meme.authorId}>`, inline: true },
      { name: '📊', value: `😂 ${stats.funny} 🔥 ${stats.legendary} ❤️ ${stats.likes}`, inline: true },
      { name: '📅', value: new Date(meme.createdAt).toLocaleDateString('ar-SA'), inline: true },
    )
    .setFooter({ text: `${t('footer.community')} • 🆔 ${meme.id.slice(0, 8)}` }).setTimestamp();
  if (!isVideoUrl(meme.imageUrl)) {
    embed.setImage(meme.imageUrl);
  }
  if (meme.voting && meme.expiresAt) {
    const remaining = new Date(meme.expiresAt).getTime() - Date.now();
    if (remaining > 0) {
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      embed.addFields({ name: '⏱️', value: t('embed.arena.time_remaining', { hours, minutes }), inline: true });
    }
  }
  return embed;
}

export function buildWinnerEmbed(meme: CommunityMeme, placement: number): EmbedBuilder {
  const stats = getCommunityVoteStats(meme.id);
  const medals = ['🥇', '🥈', '🥉'];
  const medal = medals[placement - 1] || '';
  const embed = new EmbedBuilder()
    .setColor(0xF1C40F).setTitle(`${medal} ${t('winner.announcement')}`)
    .setDescription(meme.title || t('footer.community'))
    .addFields(
      { name: '👤', value: `<@${meme.authorId}>`, inline: true },
      { name: '📊', value: t('winner.stats', { funny: stats.funny, legendary: stats.legendary, likes: stats.likes, score: stats.score }), inline: true },
      { name: '🎁', value: placement === 1 ? t('common.point') : t('common.honorable_mention'), inline: true },
    ).setTimestamp();
  if (!isVideoUrl(meme.imageUrl)) {
    embed.setImage(meme.imageUrl);
  }
  return embed;
}

export function buildProfileEmbed(profile: UserProfile, rank: number, totalUsers: number, topMeme: CommunityMeme | null): EmbedBuilder {
  const unlocked = profile.achievements.filter(a => a.unlockedAt);
  const embed = new EmbedBuilder()
    .setColor(0x9B59B6).setTitle(t('embed.profile.title'))
    .setThumbnail(profile.avatarUrl).setDescription(`<@${profile.userId}>`)
    .addFields(
      { name: `🏆 ${t('embed.profile.points')}`, value: `**${profile.totalPoints}**`, inline: true },
      { name: `🎉 ${t('embed.profile.wins')}`, value: `**${profile.totalWins}**`, inline: true },
      { name: `📤 ${t('embed.profile.submissions')}`, value: `**${profile.totalSubmissions}**`, inline: true },
      { name: `👑 ${t('embed.profile.rank')}`, value: `**#${rank}** / ${totalUsers}`, inline: true },
      { name: `📊 ${t('common.seasonal')}`, value: `${profile.seasonalPoints} ${t('common.points_abbr')} / ${profile.seasonalWins} ${t('common.wins')}`, inline: true },
    );
  if (topMeme) {
    const stats = getCommunityVoteStats(topMeme.id);
    embed.addFields({ name: t('embed.profile.favorite_meme'), value: `${topMeme.title || t('meme.untitled')} — 😂 ${stats.funny} 🔥 ${stats.legendary} ❤️ ${stats.likes}` });
  }
  if (unlocked.length > 0) {
    const badges = unlocked.map(a => `${a.emoji} ${a.name}`).join(' • ');
    embed.addFields({ name: t('common.achievements'), value: badges, inline: false });
  }
  embed.setTimestamp();
  return embed;
}

export function buildArenaHeaderEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(t('arena.title'))
    .setDescription(t('arena.description'))
    .setTimestamp();
}

export function buildSeasonEmbed(seasonName: string, topUsers: { userId: string; points: number; wins: number }[]): EmbedBuilder {
  const medals = ['🥇', '🥈', '🥉'];
  const description = topUsers.length > 0
    ? topUsers.map((u, i) =>
      `${medals[i] || `#${i + 1}`} <@${u.userId}> — **${u.points}** ${t('common.points_abbr')} • ${u.wins} ${t('common.wins')}`
    ).join('\n')
    : t('embed.season.no_data');
  return new EmbedBuilder()
    .setColor(0x9B59B6).setTitle(t('common.season_label', { name: seasonName }))
    .setDescription(description).setTimestamp();
}

export function arenaVoteButtons(memeId: string, funny: number, legendary: number, likes: number, disabled: boolean = false): ActionRowBuilder<ButtonBuilder> {
  const encId = Buffer.from(memeId).toString('base64');
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`vote_funny_${encId}`).setLabel(`😂 ${funny}`).setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`vote_legendary_${encId}`).setLabel(`🔥 ${legendary}`).setStyle(ButtonStyle.Danger).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`vote_like_${encId}`).setLabel(`❤️ ${likes}`).setStyle(ButtonStyle.Success).setDisabled(disabled),
  );
}

export function reviewButtons(submissionId: string): ActionRowBuilder<ButtonBuilder> {
  const encId = Buffer.from(submissionId).toString('base64');
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`approve_${encId}`).setLabel(t('btn.approve')).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`reject_${encId}`).setLabel(t('btn.reject')).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`delete_${encId}`).setLabel(t('btn.delete')).setStyle(ButtonStyle.Secondary),
  );
}

export function paginationRow(page: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('prev_page').setLabel(t('btn.prev')).setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
    new ButtonBuilder().setCustomId('page_info').setLabel(t('btn.page', { page, total: totalPages })).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('next_page').setLabel(t('btn.next_page')).setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages),
  );
}

import { safeString, safeStringTrimmed, safeUrl, safeId } from './validation';

const DISCORD_DESC_MAX = 4096;
const DISCORD_TITLE_MAX = 256;
const DISCORD_FIELD_NAME_MAX = 256;
const DISCORD_FIELD_VALUE_MAX = 1024;
const DISCORD_FOOTER_MAX = 2048;

interface SafeFieldInput {
  name: unknown;
  value: unknown;
  inline?: boolean;
}

export class SafeEmbedBuilder {
  private embed: EmbedBuilder;

  constructor() {
    this.embed = new EmbedBuilder();
  }

  setColor(color: number): this {
    this.embed.setColor(color);
    return this;
  }

  setTitle(value: unknown, fallback?: string): this {
    this.embed.setTitle(safeStringTrimmed(value, fallback, DISCORD_TITLE_MAX));
    return this;
  }

  setDescription(value: unknown, fallback?: string): this {
    const result = safeStringTrimmed(value, fallback, DISCORD_DESC_MAX);
    if (result) {
      this.embed.setDescription(result);
    }
    return this;
  }

  setImage(value: unknown): this {
    const url = safeUrl(value);
    if (url !== null) {
      this.embed.setImage(url);
    }
    return this;
  }

  setThumbnail(value: unknown): this {
    const url = safeUrl(value);
    if (url !== null) {
      this.embed.setThumbnail(url);
    }
    return this;
  }

  setURL(value: unknown): this {
    const url = safeUrl(value);
    if (url !== null) {
      this.embed.setURL(url);
    }
    return this;
  }

  addFields(...fields: SafeFieldInput[]): this {
    const safe = fields.map(f => ({
      name: safeStringTrimmed(f.name, '\u200B', DISCORD_FIELD_NAME_MAX),
      value: safeStringTrimmed(f.value, '\u200B', DISCORD_FIELD_VALUE_MAX),
      inline: f.inline === true,
    }));
    this.embed.addFields(safe);
    return this;
  }

  setFooter(text: unknown, iconURL?: unknown): this {
    this.embed.setFooter({
      text: safeStringTrimmed(text, '', DISCORD_FOOTER_MAX),
      ...(iconURL !== undefined && iconURL !== null ? { iconURL: safeString(iconURL) } : {}),
    });
    return this;
  }

  setTimestamp(date?: Date): this {
    this.embed.setTimestamp(date);
    return this;
  }

  setAuthor(author: { name: unknown; iconURL?: unknown; url?: unknown }): this {
    this.embed.setAuthor({
      name: safeStringTrimmed(author.name, '\u200B', DISCORD_TITLE_MAX),
      ...(author.iconURL !== undefined && author.iconURL !== null ? { iconURL: safeUrl(author.iconURL) ?? undefined } : {}),
      ...(author.url !== undefined && author.url !== null ? { url: safeUrl(author.url) ?? undefined } : {}),
    });
    return this;
  }

  build(): EmbedBuilder {
    return this.embed;
  }
}

export function safeEmbed(): SafeEmbedBuilder {
  return new SafeEmbedBuilder();
}
