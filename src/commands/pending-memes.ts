import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getPendingSubmissions } from '../data/store';
import { logCommand, logError } from '../utils/logger';
import { t } from '../utils/i18n';
import { reviewButtons, safeEmbed } from '../utils/embed';

export const data = new SlashCommandBuilder()
  .setName('الميمات-قيد-المراجعة')
  .setDescription('عرض الميمات التي تنتظر المراجعة')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ flags: ['Ephemeral'] });

    const pending = getPendingSubmissions();

    if (pending.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setDescription(t('error.no_pending'));
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const latest = pending[pending.length - 1];

    const embed = safeEmbed()
      .setColor(0xF1C40F)
      .setTitle(t('embed.review.title'))
      .setImage(latest.imageUrl)
      .addFields(
        { name: '👤', value: `<@${latest.authorId}>`, inline: true },
        { name: '#️⃣', value: latest.category, inline: true },
        { name: '📅', value: new Date(latest.submittedAt).toLocaleDateString('ar-SA'), inline: true },
      )
      .setFooter(`📝 ${pending.length} ${t('embed.mymemes.status_pending')} • ${t('footer.submitted', { user: latest.authorId, date: new Date(latest.submittedAt).toLocaleDateString('ar-SA') })}`)
      .setTimestamp()
      .setDescription(latest.title ? `**${latest.title}**` : undefined)
      .build();

    const buttons = reviewButtons(latest.id);
    await interaction.editReply({ embeds: [embed], components: [buttons] });
    logCommand(interaction.user.id, 'pending-memes', interaction.guildId!, { count: pending.length });
  } catch (error) {
    logError('pending-memes command', error);
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.unexpected'));
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
    }
  }
}
