import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getFavorites } from '../data/store';
import { paginationRow } from '../utils/embed';
import { logCommand, logError } from '../utils/logger';
import { t } from '../utils/i18n';

const MEMES_PER_PAGE = 5;
const activePaginations = new Map<string, { currentPage: number; totalPages: number; userId: string; timeout: NodeJS.Timeout | null }>();

export const data = new SlashCommandBuilder()
  .setName('مفضلتي')
  .setDescription('عرض الميمات المفضلة لديك');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const guildId = interaction.guildId!;

    const favorites = getFavorites(userId, guildId);

    if (favorites.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setDescription(t('empty.favorites'));
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const totalPages = Math.ceil(favorites.length / MEMES_PER_PAGE);
    const embeds = generateEmbedPages(favorites, totalPages);

    const row = paginationRow(1, totalPages);
    const reply = await interaction.editReply({ embeds: [embeds[0]], components: [row] });

    const paginationData = {
      currentPage: 1,
      totalPages,
      userId: interaction.user.id,
      timeout: null as NodeJS.Timeout | null,
    };

    activePaginations.set(interaction.id, paginationData);

    const filter = (i: any) => i.user.id === interaction.user.id;
    const collector = reply.createMessageComponentCollector({ filter, time: 120000 });

    collector.on('collect', async (i) => {
      const data = activePaginations.get(interaction.id);
      if (!data) return;

      if (i.customId === 'prev_page' && data.currentPage > 1) {
        data.currentPage--;
      } else if (i.customId === 'next_page' && data.currentPage < data.totalPages) {
        data.currentPage++;
      }

      const row = paginationRow(data.currentPage, data.totalPages);
      await i.update({ embeds: [embeds[data.currentPage - 1]], components: [row] });
    });

    collector.on('end', () => {
      activePaginations.delete(interaction.id);
    });
  } catch (error) {
    logError('myfavorites command', error);
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.favorites'));
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
    }
  }
}

function generateEmbedPages(favorites: any[], totalPages: number): EmbedBuilder[] {
  const embeds: EmbedBuilder[] = [];

  for (let page = 0; page < totalPages; page++) {
    const start = page * MEMES_PER_PAGE;
    const pageFavorites = favorites.slice(start, start + MEMES_PER_PAGE);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(t('embed.favorites.title'))
      .setDescription(pageFavorites.map((fav, i) =>
        `**${start + i + 1}.** [${fav.memeTitle}](${fav.memeUrl})`
      ).join('\n'))
      .setFooter({ text: t('footer.page', { page: page + 1, totalPages, total: favorites.length }) });

    embeds.push(embed);
  }

  return embeds;
}
