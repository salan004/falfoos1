import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { t } from '../utils/i18n';

export const data = new SlashCommandBuilder()
  .setName('ميم')
  .setDescription('تم استبدال هذا الأمر بـ /الساحة');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0xFFA500)
    .setDescription(t('meme.disabled'));

  await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
}
