import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { logCommand, logError } from '../utils/logger';
import { t } from '../utils/i18n';

export const data = new SlashCommandBuilder()
  .setName('مساعدة')
  .setDescription('تعلم كيفية استخدام بوت ساحة الميم');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(t('embed.help.title'))
      .setDescription(t('embed.help.description'))
      .addFields(
        {
          name: t('embed.help.commands_title'),
          value: t('embed.help.commands_list'),
          inline: false,
        },
        {
          name: t('embed.help.how_to_title'),
          value: t('embed.help.how_to'),
          inline: false,
        },
        {
          name: t('embed.help.scoring_title'),
          value: t('embed.help.scoring'),
          inline: false,
        },
      )
      .setFooter({ text: t('embed.help.footer') })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    logCommand(interaction.user.id, 'help', interaction.guildId!);
  } catch (error) {
    logError('help command', error);
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.unexpected'));
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
