import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { requireAdmin } from '../../utils/adminCommand';
import { config } from '../../config';

export async function handlePermissionsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!(await requireAdmin(interaction))) return;

  const adminRoleLine = config.adminRoleId
    ? `• Admin role: <@&${config.adminRoleId}>`
    : '• Admin role: not configured (Administrator permission only)';

  await interaction.editReply({
    content:
      '**Admin-only commands:**\n' +
      '• `/setup`, `/settings`, `/addquestion`, `/removequestion`, `/editquestion`\n' +
      '• `/import`, `/export`, `/reload`, `/permissions`\n' +
      '• Arabic equivalents: `/إضافة_سؤال`, `/حذف_سؤال`, `/تعديل_سؤال`, `/استيراد`, `/تصدير`\n\n' +
      '**Everyone can use:**\n' +
      '• `/quiz`, `/مسابقة`, `/skip`, `/leaderboard`, `/المتصدرون`\n' +
      '• `/rank`, `/profile`, `/ملفي`\n\n' +
      adminRoleLine,
  });
}
