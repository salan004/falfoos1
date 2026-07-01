import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { upsertGuildConfig } from '../../data/store';
import { AutoPostInterval } from '../../types';
import { logCommand, logError } from '../../utils/logger';
import { stopGuildSchedule, scheduleGuild } from '../../services/autoPoster';
import { t } from '../../utils/i18n';

export const data = {
  name: 'تعيين-الفاصل',
  description: 'تعيين الفاصل الزمني للنشر التلقائي',
};

const intervalLabels: Record<string, string> = {
  hourly: 'كل ساعة',
  '3hours': 'كل 3 ساعات',
  '6hours': 'كل 6 ساعات',
  '12hours': 'كل 12 ساعة',
  daily: 'كل يوم',
};

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ flags: ['Ephemeral'] });

    const interval = interaction.options.getString('الفاصل') as AutoPostInterval;

    if (!interval || !intervalLabels[interval]) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(t('error.invalid_interval'));
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    upsertGuildConfig(interaction.guildId!, { autoPostInterval: interval });

    stopGuildSchedule(interaction.guildId!);

    if (interaction.client.isReady()) {
      scheduleGuild(interaction.client, interaction.guildId!);
    }

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setDescription(t('success.interval_set', { interval: intervalLabels[interval] }));
    await interaction.editReply({ embeds: [embed] });
    logCommand(interaction.user.id, 'set-interval', interaction.guildId!, { interval });
  } catch (error) {
    logError('set-interval command', error);
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.config'));
    await interaction.editReply({ embeds: [embed] });
  }
}
