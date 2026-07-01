import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getTopCreators } from '../data/store';
import { logCommand, logError } from '../utils/logger';
import { t } from '../utils/i18n';

export const data = new SlashCommandBuilder()
  .setName('أفضل-المبدعين')
  .setDescription('عرض أفضل مبدعي الميمات');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const creators = getTopCreators(10);

    let description: string;
    if (creators.length === 0) {
      description = t('empty.contributors');
    } else {
      description = creators.map((c, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
        const label = c.approved !== 1 ? t('stats.approved_memes_plural') : t('stats.approved_memes_singular');
        return `${medal} <@${c.userId}> — ${c.approved} ${label} | 📊 ${c.score}`;
      }).join('\n');
    }

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(t('embed.topcreators.title'))
      .setDescription(description)
      .setFooter({ text: t('footer.leaderboard.updates') })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    logCommand(interaction.user.id, 'topcreators', interaction.guildId!);
  } catch (error) {
    logError('topcreators command', error);
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
