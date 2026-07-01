import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, TextChannel } from 'discord.js';
import { upsertGuildConfig } from '../../data/store';
import { logCommand, logError } from '../../utils/logger';
import { t } from '../../utils/i18n';

export const data = {
  name: 'تعيين-القناة',
  description: 'تعيين القناة للنشر التلقائي للميمات',
};

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel('القناة') as TextChannel;

    if (!channel || !channel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(t('error.invalid_channel'));
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    upsertGuildConfig(interaction.guildId!, { channelId: channel.id });

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setDescription(t('success.channel_set', { channel: channel.toString() }));
    await interaction.editReply({ embeds: [embed] });
    logCommand(interaction.user.id, 'set-channel', interaction.guildId!, { channelId: channel.id });
  } catch (error) {
    logError('set-channel command', error);
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.config'));
    await interaction.editReply({ embeds: [embed] });
  }
}
