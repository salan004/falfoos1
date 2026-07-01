import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { findGuildConfig, upsertGuildConfig } from '../../data/store';
import { logCommand, logError } from '../../utils/logger';
import { scheduleGuild } from '../../services/autoPoster';
import { t } from '../../utils/i18n';

export const data = {
  name: 'تفعيل',
  description: 'تفعيل النشر التلقائي للميمات',
};

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    const config = findGuildConfig(interaction.guildId!);

    if (!config || !config.channelId) {
      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setDescription(t('error.no_channel'));
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    upsertGuildConfig(interaction.guildId!, { autoPostEnabled: true });

    if (interaction.client.isReady()) {
      scheduleGuild(interaction.client, interaction.guildId!);
    }

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setDescription(t('success.enabled'));
    await interaction.editReply({ embeds: [embed] });
    logCommand(interaction.user.id, 'enable', interaction.guildId!);
  } catch (error) {
    logError('enable command', error);
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.config'));
    await interaction.editReply({ embeds: [embed] });
  }
}
