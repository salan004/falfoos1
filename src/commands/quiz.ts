import { ChatInputCommandInteraction, TextChannel, MessageFlags } from 'discord.js';
import { startQuiz } from '../services/quizService';

function getQuizOptions(interaction: ChatInputCommandInteraction): {
  totalQuestions: number;
  categoryId?: number;
} {
  const totalQuestions =
    interaction.options.getInteger('questions') ??
    interaction.options.getInteger('عدد_الأسئلة') ??
    5;

  const categoryStr =
    interaction.options.getString('category') ??
    interaction.options.getString('التصنيف');

  const categoryId = categoryStr ? parseInt(categoryStr, 10) : undefined;
  return { totalQuestions, categoryId };
}

export async function handleQuizCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { totalQuestions, categoryId } = getQuizOptions(interaction);

  const channel = interaction.channel;
  if (!channel || !channel.isTextBased() || !(channel instanceof TextChannel)) {
    await interaction.editReply({ content: '❌ This command must be used in a text channel.' });
    return;
  }

  await interaction.editReply({
    content: `📖 **بدأت المسابقة!** عدد الأسئلة: ${totalQuestions}\nتم بدء التسجيل في ${channel} - اضغط على زر **انضمام** للمشاركة.`,
  });

  await startQuiz(channel, interaction.user.id, totalQuestions, categoryId);
}
