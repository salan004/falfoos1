import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { requireAdmin } from '../../utils/adminCommand';
import { initDb } from '../../database/connection';
import { seedDatabase } from '../../database/seed';

export async function handleReloadCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!(await requireAdmin(interaction))) return;

  try {
    await initDb();
    await seedDatabase();
    await interaction.editReply({ content: '✅ Database reloaded and seed data refreshed.' });
  } catch (err) {
    console.error('[RELOAD ERROR]', err);
    await interaction.editReply({ content: '❌ Failed to reload the database.' });
  }
}
