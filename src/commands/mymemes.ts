import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getUserMemeHistory, getCommunityVoteStats } from '../data/store';
import { logCommand, logError } from '../utils/logger';
import { t } from '../utils/i18n';
import { paginationRow } from '../utils/embed';
import { CommunityMeme } from '../types';

const MEMES_PER_PAGE = 5;

export const data = new SlashCommandBuilder()
  .setName('ميماتي')
  .setDescription('عرض الميمات التي أرسلتها');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const memes = getUserMemeHistory(interaction.user.id);

    if (memes.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle(t('embed.mymemes.title'))
        .setDescription(t('embed.mymemes.empty'));
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const totalPages = Math.ceil(memes.length / MEMES_PER_PAGE);
    let currentPage = 0;

    const pageEmbed = buildPage(memes, currentPage);
    const row = paginationRow(currentPage + 1, totalPages);

    const reply = await interaction.editReply({ embeds: [pageEmbed], components: [row] });

    const filter = (i: any) => i.user.id === interaction.user.id;
    const collector = reply.createMessageComponentCollector({ filter, time: 120000 });

    collector.on('collect', async (i: any) => {
      if (i.customId === 'prev_page' && currentPage > 0) {
        currentPage--;
      } else if (i.customId === 'next_page' && currentPage < totalPages - 1) {
        currentPage++;
      }

      const newEmbed = buildPage(memes, currentPage);
      const newRow = paginationRow(currentPage + 1, totalPages);
      await i.update({ embeds: [newEmbed], components: [newRow] });
    });

    collector.on('end', () => {});
    logCommand(interaction.user.id, 'mymemes', interaction.guildId!, { count: memes.length });
  } catch (error) {
    logError('mymemes command', error);
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.stats'));
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
    }
  }
}

function buildPage(memes: CommunityMeme[], page: number): EmbedBuilder {
  const start = page * MEMES_PER_PAGE;
  const pageMemes = memes.slice(start, start + MEMES_PER_PAGE);

  const items = pageMemes.map((m, i) => {
    const stats = getCommunityVoteStats(m.id);
    const status = m.voting
      ? t('embed.mymemes.status_voting')
      : m.winner
        ? t('embed.mymemes.winner')
        : t('embed.mymemes.status_completed');
    const medal = m.winner ? '🏆 ' : '';
    return `${medal}**#${start + i + 1}** — ${m.title || t('meme.untitled')} — ${status}\n😂 ${stats.funny} 🔥 ${stats.legendary} ❤️ ${stats.likes} | 📊 ${stats.score}`;
  });

  const totalPages = Math.ceil(memes.length / MEMES_PER_PAGE);
  return new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(t('embed.mymemes.title'))
    .setDescription(items.join('\n\n'))
    .setFooter({ text: t('mymemes.page_footer', { page: page + 1, totalPages, total: memes.length }) })
    .setTimestamp();
}
