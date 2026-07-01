<<<<<<< HEAD
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
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
=======
import { ChatInputCommandInteraction } from 'discord.js';
import { getUser, getUserRank, upsertUser } from '../database/users';
import { getNextLevelPoints } from '../services/levelService';
import { buildProfileEmbed } from '../utils/embedBuilder';

export async function handleProfileCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  upsertUser(userId, guildId, interaction.user.username);
  const user = getUser(userId, guildId);

  if (!user) {
    await interaction.editReply({ content: '❌ الملف الشخصي غير موجود. شارك في مسابقة أولاً!' });
    return;
  }

  const rankInfo = getUserRank(userId, guildId);
  const nextLevelPoints = getNextLevelPoints(user.level + 1);

  const embed = buildProfileEmbed({
    username: user.username || interaction.user.username,
    points: user.points,
    coins: user.coins,
    level: user.level,
    correctAnswers: user.correct_answers,
    wrongAnswers: user.wrong_answers,
    totalQuizzes: user.total_quizzes,
    nextLevelPoints,
    rank: rankInfo?.rank,
    currentStreak: user.current_streak || 0,
    bestStreak: user.best_streak || 0,
    firstPlace: user.first_place || 0,
    secondPlace: user.second_place || 0,
    thirdPlace: user.third_place || 0,
    totalWins: user.total_wins || 0,
  });

  await interaction.editReply({ embeds: [embed] });
>>>>>>> 7a303d754a86e399d51568f3e72b09aa6c8bd1df
}
