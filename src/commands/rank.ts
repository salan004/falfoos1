import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { getUser, getUserRank, upsertUser } from '../database/users';
import { buildRankEmbed } from '../utils/embedBuilder';

export async function handleRankCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const userId = interaction.user.id;
  const guildId = interaction.guildId!;

  upsertUser(userId, guildId, interaction.user.username);
  const user = getUser(userId, guildId);

  if (!user) {
    await interaction.editReply({ content: '❌ Profile not found. Join a quiz first!' });
    return;
  }

  const rankInfo = getUserRank(userId, guildId);
  if (!rankInfo) {
    await interaction.editReply({ content: '❌ Could not determine your rank.' });
    return;
  }

  const embed = buildRankEmbed(
    user.username || interaction.user.username,
    rankInfo.rank,
    user.points,
    user.level,
    rankInfo.totalPlayers,
  );

  await interaction.editReply({ embeds: [embed] });
}
