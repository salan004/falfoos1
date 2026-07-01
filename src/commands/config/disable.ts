import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { upsertGuildConfig } from '../../data/store';
import { logCommand, logError } from '../../utils/logger';
import { stopGuildSchedule } from '../../services/autoPoster';
import { t } from '../../utils/i18n';

export const data = {
  name: 'تعطيل',
  description: 'تعطيل النشر التلقائي للميمات',
};

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    upsertGuildConfig(interaction.guildId!, { autoPostEnabled: false });

    stopGuildSchedule(interaction.guildId!);

    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setDescription(t('success.disabled'));
    await interaction.editReply({ embeds: [embed] });
    logCommand(interaction.user.id, 'disable', interaction.guildId!);
  } catch (error) {
    logError('disable command', error);
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.config'));
    await interaction.editReply({ embeds: [embed] });
  }
}
