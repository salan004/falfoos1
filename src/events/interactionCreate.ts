import { Events, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { client } from '../client';
import { handleQuizCommand } from '../commands/quiz';
import { handleLeaderboardCommand } from '../commands/leaderboard';
import { handleProfileCommand } from '../commands/profile';
import { handleRankCommand } from '../commands/rank';
import { handleSkipCommand } from '../commands/skip';
import { handleAddQuestion } from '../commands/admin/addQuestion';
import { handleEditQuestion } from '../commands/admin/editQuestion';
import { handleDeleteQuestion } from '../commands/admin/deleteQuestion';
import { handleImportJson } from '../commands/admin/importJson';
import { handleExportJson } from '../commands/admin/exportJson';
import { handleSetupCommand, handleSettingsCommand } from '../commands/admin/setup';
import { handleReloadCommand } from '../commands/admin/reload';
import { handlePermissionsCommand } from '../commands/admin/permissions';

export function registerInteractionEvent(): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const commandMap: Record<string, (i: ChatInputCommandInteraction) => Promise<void>> = {
          'مسابقة': handleQuizCommand,
          'quiz': handleQuizCommand,
          'المتصدرون': handleLeaderboardCommand,
          'leaderboard': handleLeaderboardCommand,
          'ملفي': handleProfileCommand,
          'profile': handleProfileCommand,
          'rank': handleRankCommand,
          'skip': handleSkipCommand,
          'إضافة_سؤال': handleAddQuestion,
          'addquestion': handleAddQuestion,
          'تعديل_سؤال': handleEditQuestion,
          'editquestion': handleEditQuestion,
          'حذف_سؤال': handleDeleteQuestion,
          'removequestion': handleDeleteQuestion,
          'استيراد': handleImportJson,
          'import': handleImportJson,
          'تصدير': handleExportJson,
          'export': handleExportJson,
          'setup': handleSetupCommand,
          'settings': handleSettingsCommand,
          'reload': handleReloadCommand,
          'permissions': handlePermissionsCommand,
        };

        const handler = commandMap[interaction.commandName];
        if (handler) {
          await handler(interaction);
        }
      }
    } catch (error) {
      console.error('❌ Interaction handler error:', error);
      if (interaction.isRepliable()) {
        const errMsg = 'An unexpected error occurred. Please try again.';
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: errMsg }).catch(() => {});
        } else {
          await interaction.reply({ content: errMsg, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
      }
    }
  });
}
