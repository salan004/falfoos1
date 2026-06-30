import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { requireAdmin } from '../../utils/adminCommand';
import { bulkImportQuestions, getCategories } from '../../database/questions';

export async function handleImportJson(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!(await requireAdmin(interaction))) return;

  const attachment = interaction.options.getAttachment('file') ?? interaction.options.getAttachment('الملف', true);

  if (!attachment.name.endsWith('.json')) {
    await interaction.editReply({ content: '❌ Please upload a valid JSON file.' });
    return;
  }

  try {
    const response = await fetch(attachment.url);
    const data = await response.json() as any[];

    if (!Array.isArray(data) || data.length === 0) {
      await interaction.editReply({ content: '❌ The file is empty or invalid.' });
      return;
    }

    const categoryMap = new Map<string, number>();
    const catRows = getCategories();
    for (const c of catRows) {
      categoryMap.set(c.name_ar, c.id);
    }

    const questions: any[] = [];
    const errors: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const categoryId = categoryMap.get(item.category);
      if (!categoryId) {
        errors.push(`Row ${i + 1}: category "${item.category}" not found`);
        continue;
      }

      if (!item.question_ar || !item.options?.A || !item.options?.B || !item.options?.C || !item.options?.D || !item.correct) {
        errors.push(`Row ${i + 1}: missing data`);
        continue;
      }

      if (!['A', 'B', 'C', 'D'].includes(item.correct)) {
        errors.push(`Row ${i + 1}: invalid correct answer: ${item.correct}`);
        continue;
      }

      questions.push({
        categoryId,
        questionAr: item.question_ar,
        optionA: item.options.A,
        optionB: item.options.B,
        optionC: item.options.C,
        optionD: item.options.D,
        correctAnswer: item.correct,
        difficulty: item.difficulty || 1,
        source: item.source || null,
      });
    }

    if (questions.length === 0) {
      await interaction.editReply({ content: '❌ No valid questions were found in the file.' });
      return;
    }

    const imported = bulkImportQuestions(questions);

    let reply = `✅ **Imported ${imported} question(s) successfully!**`;
    if (errors.length > 0) {
      const sample = errors.slice(0, 5).join('\n');
      reply += `\n\n⚠️ ${errors.length} error(s):\n${sample}`;
      if (errors.length > 5) {
        reply += `\n... and ${errors.length - 5} more`;
      }
    }

    await interaction.editReply({ content: reply });
  } catch (error) {
    console.error('Import error:', error);
    await interaction.editReply({ content: '❌ Failed to import the file. Check the JSON format.' });
  }
}
