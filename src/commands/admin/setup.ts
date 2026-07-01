import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { requireAdmin } from '../../utils/adminCommand';
import { config } from '../../config';

export async function handleSetupCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!(await requireAdmin(interaction))) return;

  await interaction.editReply({
    content:
      '**Islamic Quiz Bot Setup**\n\n' +
      '1. Ensure the bot has **Send Messages**, **Embed Links**, and **Create Polls** permissions.\n' +
      '2. Use `/addquestion` or `/إضافة_سؤال` to add questions.\n' +
      '3. Optionally set `ADMIN_ROLE_ID` in `.env` for non-administrator moderators.\n' +
      '4. Members can start quizzes with `/quiz` or `/مسابقة`.\n\n' +
      `Current quiz timer: **${config.quizTimeLimit / 1000}s** per question.`,
  });
}

export async function handleSettingsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!(await requireAdmin(interaction))) return;

  await interaction.editReply({
    content:
      '**Bot Settings**\n\n' +
      `• Quiz time limit: **${config.quizTimeLimit / 1000}s**\n` +
      `• Speed bonus window: **${config.speedBonusWindow / 1000}s**\n` +
      `• Speed bonus points: **+${config.speedBonusPoints}**\n` +
      `• Max questions per quiz: **${config.maxQuestionsPerQuiz}**\n` +
      `• Leaderboard page size: **${config.leaderboardPageSize}**\n` +
      (config.adminRoleId ? `• Admin role: <@&${config.adminRoleId}>` : '• Admin role: not configured'),
  });
}
