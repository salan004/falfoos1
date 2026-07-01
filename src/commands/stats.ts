import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getServerStats, getTopCommunityMemes, getLeaderboardByPoints } from '../data/store';
import { logCommand, logError } from '../utils/logger';
import { t } from '../utils/i18n';

export const data = new SlashCommandBuilder()
  .setName('الإحصائيات')
  .setDescription('عرض إحصائيات ساحة الميم العامة');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const stats = getServerStats();
    const topMemes = getTopCommunityMemes(undefined, 3);
    const topUsers = getLeaderboardByPoints(3);

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(t('embed.stats.server_title'))
      .addFields(
        { name: `🖼️ ${t('embed.stats.total_memes')}`, value: `**${stats.totalMemes}**`, inline: true },
        { name: `👥 ${t('embed.stats.total_users')}`, value: `**${stats.totalUsers}**`, inline: true },
        { name: `🗳️ ${t('embed.stats.total_votes')}`, value: `**${stats.totalVotes}**`, inline: true },
        { name: `⏳ ${t('embed.stats.active_votings')}`, value: `**${stats.activeVotings}**`, inline: true },
        { name: `🏆 ${t('embed.stats.total_points')}`, value: `**${stats.totalPoints}**`, inline: true },
      );

    if (topMemes.length > 0) {
      const topMemeText = topMemes.map((m, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        return `${medal} **${m.title || t('meme.untitled')}** — 😂 ${m.funny} 🔥 ${m.legendary} ❤️ ${m.likes} | 📊 ${m.score}`;
      }).join('\n');
      embed.addFields({ name: t('stats.top_memes_title'), value: topMemeText, inline: false });
    }

    if (topUsers.length > 0) {
      const topUserText = topUsers.map((u, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
        return `${medal} <@${u.userId}> — ${t('stats.points_wins', { points: u.totalPoints, wins: u.totalWins })}`;
      }).join('\n');
      embed.addFields({ name: t('stats.top_users_title'), value: topUserText, inline: false });
    }

    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    logCommand(interaction.user.id, 'stats', interaction.guildId!);
  } catch (error) {
    logError('stats command', error);
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.stats'));
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
