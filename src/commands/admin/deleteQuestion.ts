import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { requireAdmin } from '../../utils/adminCommand';
import { deleteQuestion } from '../../database/questions';

export async function handleDeleteQuestion(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!(await requireAdmin(interaction))) return;

  const id = interaction.options.getInteger('question_id') ?? interaction.options.getInteger('رقم_السؤال', true);
  const deleted = deleteQuestion(id);

  if (deleted) {
    await interaction.editReply({ content: `✅ **Question #${id} deleted successfully!**` });
  } else {
    await interaction.editReply({ content: `❌ Question #${id} was not found.` });
  }
}
