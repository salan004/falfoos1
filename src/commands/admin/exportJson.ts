import { ChatInputCommandInteraction, AttachmentBuilder, MessageFlags } from 'discord.js';
import { requireAdmin } from '../../utils/adminCommand';
import { getAllQuestions } from '../../database/questions';

export async function handleExportJson(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!(await requireAdmin(interaction))) return;

  const categoryStr = interaction.options.getString('category') ?? interaction.options.getString('التصنيف');
  let categoryId: number | undefined;
  let fileName = 'questions';

  if (categoryStr && categoryStr !== 'all') {
    categoryId = parseInt(categoryStr, 10);
    fileName = `questions_category_${categoryId}`;
  }

  const questions = getAllQuestions(categoryId);

  const exportData = questions.map(q => ({
    question_ar: q.questionAr,
    category: q.categoryNameAr || '',
    options: {
      A: q.optionA,
      B: q.optionB,
      C: q.optionC,
      D: q.optionD,
    },
    correct: q.correctAnswer,
    difficulty: q.difficulty,
    source: q.source || undefined,
  }));

  const jsonStr = JSON.stringify(exportData, null, 2);
  const buffer = Buffer.from(jsonStr, 'utf-8');
  const attachment = new AttachmentBuilder(buffer, { name: `${fileName}.json` });

  await interaction.editReply({
    content: `✅ **Exported ${exportData.length} question(s) successfully!**`,
    files: [attachment],
  });
}
