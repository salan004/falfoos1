import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getUserStats } from '../data/store';
import { logCommand, logError } from '../utils/logger';
import { t } from '../utils/i18n';

export const data = new SlashCommandBuilder()
  .setName('إحصائياتي')
  .setDescription('عرض إحصائيات الميم الخاصة بك');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const stats = getUserStats(interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(t('embed.stats.title'))
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: `📤 ${t('stats.submitted')}`, value: String(stats.submitted), inline: true },
        { name: `✅ ${t('stats.approved')}`, value: String(stats.approved), inline: true },
        { name: `👍 ${t('stats.likes_received')}`, value: String(stats.likesReceived), inline: true },
        { name: `📊 ${t('stats.score')}`, value: String(stats.score), inline: true },
      )
      .setFooter({ text: t('footer.stats', { date: new Date().toLocaleDateString('ar-SA') }) })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    logCommand(interaction.user.id, 'mystats', interaction.guildId!);
  } catch (error) {
    logError('mystats command', error);
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
