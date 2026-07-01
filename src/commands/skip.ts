import { ChatInputCommandInteraction, TextChannel, MessageFlags } from 'discord.js';
import { skipCurrentQuestion } from '../services/quizService';

export async function handleSkipCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channel = interaction.channel;
  if (!channel || !channel.isTextBased() || !(channel instanceof TextChannel)) {
    await interaction.editReply({ content: '❌ This command must be used in a text channel.' });
    return;
  }

  const skipped = await skipCurrentQuestion(channel, interaction.user.id);
  if (!skipped) {
    await interaction.editReply({
      content: '❌ No active quiz to skip in this channel, or you lack permission to skip.',
    });
    return;
  }

  await interaction.editReply({ content: '⏭️ Current question skipped.' });
}
