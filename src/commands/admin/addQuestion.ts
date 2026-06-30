import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { requireAdmin } from '../../utils/adminCommand';
import { addQuestion } from '../../database/questions';

function getAddQuestionInputs(interaction: ChatInputCommandInteraction) {
  return {
    questionAr: interaction.options.getString('question') ?? interaction.options.getString('السؤال', true),
    optionA: interaction.options.getString('option_a') ?? interaction.options.getString('الخيار_أ', true),
    optionB: interaction.options.getString('option_b') ?? interaction.options.getString('الخيار_ب', true),
    optionC: interaction.options.getString('option_c') ?? interaction.options.getString('الخيار_ج', true),
    optionD: interaction.options.getString('option_d') ?? interaction.options.getString('الخيار_د', true),
    correctAnswer: (interaction.options.getString('correct_answer') ?? interaction.options.getString('الإجابة_الصحيحة', true)) as 'A' | 'B' | 'C' | 'D',
    categoryId: parseInt(
      interaction.options.getString('category') ?? interaction.options.getString('التصنيف', true)!,
      10,
    ),
    difficulty: interaction.options.getInteger('difficulty') ?? interaction.options.getInteger('الصعوبة') ?? 1,
    source: interaction.options.getString('source') ?? interaction.options.getString('المصدر') ?? undefined,
  };
}

export async function handleAddQuestion(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!(await requireAdmin(interaction))) return;

  const inputs = getAddQuestionInputs(interaction);
  const id = addQuestion(
    inputs.categoryId,
    inputs.questionAr,
    inputs.optionA,
    inputs.optionB,
    inputs.optionC,
    inputs.optionD,
    inputs.correctAnswer,
    inputs.difficulty,
    inputs.source,
  );

  await interaction.editReply({
    content: `✅ **Question added successfully!**\n🆔 Question ID: ${id}`,
  });
}
