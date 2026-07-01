import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { requireAdmin } from '../../utils/adminCommand';
import { getQuestionById, updateQuestion } from '../../database/questions';

export async function handleEditQuestion(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!(await requireAdmin(interaction))) return;

  const id = interaction.options.getInteger('question_id') ?? interaction.options.getInteger('رقم_السؤال', true);
  const existing = getQuestionById(id);

  if (!existing) {
    await interaction.editReply({ content: `❌ Question #${id} was not found.` });
    return;
  }

  const questionAr = interaction.options.getString('question') ?? interaction.options.getString('السؤال') ?? existing.questionAr;
  const optionA = interaction.options.getString('option_a') ?? interaction.options.getString('الخيار_أ') ?? existing.optionA;
  const optionB = interaction.options.getString('option_b') ?? interaction.options.getString('الخيار_ب') ?? existing.optionB;
  const optionC = interaction.options.getString('option_c') ?? interaction.options.getString('الخيار_ج') ?? existing.optionC;
  const optionD = interaction.options.getString('option_d') ?? interaction.options.getString('الخيار_د') ?? existing.optionD;
  const correctAnswer = (
    interaction.options.getString('correct_answer') ??
    interaction.options.getString('الإجابة_الصحيحة') ??
    existing.correctAnswer
  ) as 'A' | 'B' | 'C' | 'D';
  const categoryIdStr = interaction.options.getString('category') ?? interaction.options.getString('التصنيف');
  const categoryId = categoryIdStr ? parseInt(categoryIdStr, 10) : existing.categoryId;
  const difficulty = interaction.options.getInteger('difficulty') ?? interaction.options.getInteger('الصعوبة') ?? existing.difficulty;

  updateQuestion(
    id,
    categoryId,
    questionAr,
    optionA,
    optionB,
    optionC,
    optionD,
    correctAnswer,
    difficulty,
    existing.source || undefined,
  );

  await interaction.editReply({
    content: `✅ **Question #${id} updated successfully!**`,
  });
}
