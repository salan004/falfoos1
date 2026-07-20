import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { getTopVotingMemes, getCommunityVoteStats } from '../data/store';
import { buildArenaMemeEmbed, arenaVoteButtons, buildArenaHeaderEmbed, isVideoUrl } from '../utils/embed';
import { checkCooldown } from '../utils/cooldown';
import { logCommand } from '../utils/logger';
import { t } from '../utils/i18n';

export const data = new SlashCommandBuilder()
  .setName('الساحة')
  .setDescription('عرض أفضل 3 ميمات يتم التصويت عليها حالياً!');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const cooldown = await checkCooldown(interaction.user.id, 'arena', interaction.guildId!);
    if (cooldown.onCooldown) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setDescription(t('error.cooldown', { seconds: cooldown.remainingSeconds }));
      await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
      return;
    }

    await interaction.deferReply();

    const topMemes = getTopVotingMemes(3);

    if (topMemes.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setDescription(t('arena.no_active'));
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const headerEmbed = buildArenaHeaderEmbed();
    const embeds = [headerEmbed, ...topMemes.map(m => buildArenaMemeEmbed(m))];
    const components = topMemes.map(m => {
      const stats = getCommunityVoteStats(m.id);
      return arenaVoteButtons(m.id, stats.funny, stats.legendary, stats.likes, !m.voting);
    });
    const videoFiles = topMemes
      .filter(m => isVideoUrl(m.imageUrl))
      .map((m, i) => new AttachmentBuilder(m.imageUrl, { name: `video_${i}.mp4` }));

    await interaction.editReply({ embeds, components, files: videoFiles.length > 0 ? videoFiles : undefined });
    logCommand(interaction.user.id, 'arena', interaction.guildId!, { count: topMemes.length, topScores: topMemes.map(m => m.score) });
  } catch (error) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.unexpected'));
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
    }
  }
}
