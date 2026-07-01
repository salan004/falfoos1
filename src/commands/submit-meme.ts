import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, TextChannel, GuildMember } from 'discord.js';
import { addPendingSubmission, isDuplicateImage, getUserSubmissionCountToday, findGuildConfig, getUserStats } from '../data/store';
import { logCommand, logError } from '../utils/logger';
import { t } from '../utils/i18n';
import { reviewButtons, safeEmbed } from '../utils/embed';
import { filterContent } from '../utils/contentFilter';
import { isAdmin } from '../utils/permissions';
import { MemeCategory } from '../types';

export const data = new SlashCommandBuilder()
  .setName('إرسال-ميم')
  .setDescription('إرسال ميم للمراجعة')
  .addAttachmentOption(option =>
    option
      .setName('الصورة')
      .setDescription('ارفع صورة الميم')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('العنوان')
      .setDescription('عنوان اختياري للميم')
      .setRequired(false)
      .setMaxLength(100)
  )
  .addStringOption(option =>
    option
      .setName('التصنيف')
      .setDescription('اختر تصنيفاً')
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
    await interaction.deferReply({ ephemeral: true });

    const image = interaction.options.getAttachment('الصورة', true);
    const title = interaction.options.getString('العنوان') || '';
    const category = (interaction.options.getString('التصنيف') || 'random') as MemeCategory;

    if (!image.contentType?.startsWith('image/')) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(t('error.submit_nsfw'));
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (image.size > 10 * 1024 * 1024) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(t('error.submit_nsfw'));
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const filterResult = filterContent(title, false, image.url);
    if (!filterResult.safe) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(t('error.submit_nsfw'));
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const member = interaction.member;
    if (!(member instanceof GuildMember && isAdmin(member))) {
      const todayCount = getUserSubmissionCountToday(interaction.user.id);
      if (todayCount >= 3) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setDescription(t('error.submit_limit'));
        await interaction.editReply({ embeds: [embed] });
        return;
      }
    }

    if (isDuplicateImage(image.url)) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(t('error.submit_duplicate'));
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    let reviewChannel: TextChannel | null = null;
    const guildConfig = findGuildConfig(interaction.guildId!);
    if (guildConfig?.reviewChannelId) {
      const ch = interaction.guild?.channels.cache.get(guildConfig.reviewChannelId);
      if (ch?.isTextBased()) reviewChannel = ch as TextChannel;
    }

    if (!reviewChannel) {
      const chByName = interaction.guild?.channels.cache.find(
        c => (c.name === 'meme-review' || c.name === 'ميم-مراجعة') && c.isTextBased()
      );
      if (chByName) reviewChannel = chByName as TextChannel;
    }

    if (!reviewChannel) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(t('error.submit_no_channel'));
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const submission = addPendingSubmission({
      authorId: interaction.user.id,
      imageUrl: image.url,
      title,
      category,
    });

    const embed = safeEmbed()
      .setColor(0xF1C40F)
      .setTitle(t('embed.review.title'))
      .setImage(image.url)
      .addFields(
        { name: '👤', value: `<@${interaction.user.id}>`, inline: true },
        { name: '#️⃣', value: category, inline: true },
        { name: '📅', value: new Date().toLocaleDateString('ar-SA'), inline: true },
      )
      .setFooter(t('footer.submitted', { user: interaction.user.tag, date: new Date().toLocaleDateString('ar-SA') }))
      .setTimestamp()
      .setDescription(title ? `**${title}**` : undefined)
      .build();

    const buttons = reviewButtons(submission.id);
    await reviewChannel.send({ embeds: [embed], components: [buttons] });

    const successEmbed = safeEmbed()
      .setColor(0x00FF00)
      .setDescription(t('success.meme_submitted', { channel: reviewChannel.toString() }))
      .build();
    await interaction.editReply({ embeds: [successEmbed] });
    logCommand(interaction.user.id, 'submit-meme', interaction.guildId!, { category, hasTitle: !!title });
  } catch (error) {
    logError('submit-meme command', error);
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.unexpected'));
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
