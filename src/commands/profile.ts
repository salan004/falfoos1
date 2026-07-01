import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getUserProfile, getUserStats, getUserRank, getUserMemeHistory, updateUserProfile } from '../data/store';
import { logCommand, logError } from '../utils/logger';
import { t } from '../utils/i18n';
import { buildProfileEmbed } from '../utils/embed';

export const data = new SlashCommandBuilder()
  .setName('الملف')
  .setDescription('عرض ملفك الشخصي وإحصائياتك في ساحة الميم')
  .addUserOption(option =>
    option
      .setName('المستخدم')
      .setDescription('المستخدم لعرض ملفه (الافتراضي أنت)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user') || interaction.user;

    updateUserProfile(targetUser.id, {
      username: targetUser.username,
      avatarUrl: targetUser.displayAvatarURL(),
    });

    const profile = getUserProfile(targetUser.id);
    const stats = getUserStats(targetUser.id);
    const { rank, totalUsers } = getUserRank(targetUser.id);
    const history = getUserMemeHistory(targetUser.id);
    const topMeme = history.length > 0 ? history.sort((a, b) => b.score - a.score)[0] : null;

    const embed = buildProfileEmbed(profile, rank, totalUsers, topMeme);

    const winRate = stats.submitted > 0
      ? ((stats.wins / stats.submitted) * 100).toFixed(1)
      : '0.0';

    embed.addFields(
      { name: `📊 ${t('stats.score')}`, value: `${stats.score}`, inline: true },
      { name: `🎯 ${t('stats.win_rate')}`, value: `${winRate}%`, inline: true },
    );

    await interaction.editReply({ embeds: [embed] });
    logCommand(interaction.user.id, 'profile', interaction.guildId!, { target: targetUser.id });
  } catch (error) {
    logError('profile command', error);
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
