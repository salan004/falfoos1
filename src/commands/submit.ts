import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, TextChannel, GuildMember } from 'discord.js';
import { addPendingSubmission, isDuplicateImage, getUserSubmissionCountToday, findGuildConfig, incrementUserSubmissions, updateUserProfile } from '../data/store';
import { logCommand, logError } from '../utils/logger';
import { t } from '../utils/i18n';
import { reviewButtons, safeEmbed } from '../utils/embed';
import { filterContent } from '../utils/contentFilter';
import { memberHasAdminAccess } from '../utils/permissions';
import { MemeCategory } from '../types';

export const data = new SlashCommandBuilder()
  .setName('إرسال')
  .setDescription('إرسال ميم إلى الساحة للمراجعة')
  .addAttachmentOption(option =>
    option
      .setName('الميم')
      .setDescription('ارفع صورة/GIF/فيديو الميم')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('العنوان')
      .setDescription('عنوان اختياري للميم (100 حرف كحد أقصى)')
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
    await interaction.deferReply({ flags: ['Ephemeral'] });

    const image = interaction.options.getAttachment('الميم', true);
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

    const hasAccess = memberHasAdminAccess(
      interaction.member as GuildMember | null,
      interaction.memberPermissions,
      interaction.guild?.ownerId,
      interaction.user.id,
    );
    console.log(`User ${interaction.user.id} isAdmin status: ${hasAccess}`);
    if (!hasAccess) {
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

    incrementUserSubmissions(interaction.user.id);
    updateUserProfile(interaction.user.id, {
      username: interaction.user.username,
      avatarUrl: interaction.user.displayAvatarURL(),
    });

    const embed = safeEmbed()
      .setColor(0x9B59B6)
      .setTitle(t('submit.embed.title'))
      .setImage(image.url)
      .addFields(
        { name: t('submit.embed.author'), value: `<@${interaction.user.id}>`, inline: true },
        { name: t('submit.embed.category'), value: category, inline: true },
        { name: t('submit.embed.date'), value: new Date().toLocaleDateString('ar-SA'), inline: true },
        { name: t('submit.embed.id'), value: `\`${submission.id.slice(0, 8)}\``, inline: true },
        { name: t('submit.embed.status'), value: t('submit.embed.status_pending'), inline: true },
      )
      .setDescription(title ? `**${title}**` : undefined)
      .setFooter(t('submit.embed.footer', { user: interaction.user.tag }))
      .setTimestamp()
      .build();

    const buttons = reviewButtons(submission.id);
    await reviewChannel.send({ embeds: [embed], components: [buttons] });

    const successEmbed = safeEmbed()
      .setColor(0x00FF00)
      .setDescription(t('success.meme_submitted', { channel: reviewChannel.toString() }))
      .build();
    await interaction.editReply({ embeds: [successEmbed] });
    logCommand(interaction.user.id, 'submit', interaction.guildId!, { category, hasTitle: !!title });
  } catch (error) {
    logError('submit command', error);
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
