import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getTopCommunityMemes } from '../data/store';
import { logCommand, logError } from '../utils/logger';
import { t } from '../utils/i18n';
import { MemeCategory } from '../types';

export const data = new SlashCommandBuilder()
  .setName('أفضل-الميمات')
  .setDescription('عرض أفضل الميمات المجتمعية')
  .addStringOption(option =>
    option
      .setName('التصنيف')
      .setDescription('تصفية حسب التصنيف')
      .setRequired(false)
      .addChoices(
        { name: '🌍 عربي', value: 'arabic' },
        { name: '🎮 ألعاب', value: 'gaming' },
        { name: '💬 ديسكورد', value: 'discord' },
        { name: '📚 مدرسة', value: 'school' },
        { name: '🌐 إنترنت', value: 'internet' },
        { name: '🎲 عشوائي', value: 'random' },
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const category = interaction.options.getString('التصنيف') || undefined;
    const topMemes = getTopCommunityMemes(category, 10);

    const categoryEmojis: Record<string, string> = {
      arabic: '🌍', gaming: '🎮', discord: '💬',
      school: '📚', internet: '🌐', random: '🎲',
    };

    let description: string;
    if (topMemes.length === 0) {
      description = t('empty.top_memes');
    } else {
      description = topMemes.map((meme, i) => {
        const emoji = categoryEmojis[meme.category] || '🎲';
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
        return `${medal} ${emoji} 😂 ${meme.funny} 🔥 ${meme.legendary} ❤️ ${meme.likes} | 📊 ${meme.score}\n${meme.title || t('footer.community')}\n${t('footer.author', { author: `<@${meme.authorId}>` })}`;
      }).join('\n\n');
    }

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle(t('embed.topmemes.title'))
      .setDescription(description)
      .setFooter({ text: t('footer.leaderboard.updates') })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    logCommand(interaction.user.id, 'topmemes', interaction.guildId!, { category });
  } catch (error) {
    logError('topmemes command', error);
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.leaderboard'));
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
    }
  }
}
