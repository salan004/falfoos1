import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, AttachmentBuilder } from 'discord.js';
import { getTopVotedMemes, getTopContributors, getMostActiveUsers } from '../services/leaderboardService';
import { getLeaderboardByPoints, getTopCommunityMemes, getTopCreators, getSeasonalLeaderboard, getWeeklyLeaderboard, getHallOfFame, getActiveSeason } from '../data/store';
import { generateLeaderboardImage } from '../services/leaderboardImage';
import { logCommand, logError } from '../utils/logger';
import { t } from '../utils/i18n';

export const data = new SlashCommandBuilder()
  .setName('المتصدرين')
  .setDescription('عرض لوحات المتصدرين')
  .addStringOption(option =>
    option
      .setName('النوع')
      .setDescription('اختر نوع لوحة المتصدرين')
      .setRequired(false)
      .addChoices(
        { name: '👑 النقاط', value: 'points' },
        { name: '📊 الموسمي', value: 'seasonal' },
        { name: '📈 الأسبوعي', value: 'weekly' },
        { name: '🏛️ قاعة المشاهير', value: 'hall_of_fame' },
        { name: '🏆 أفضل الميمات تصويتاً', value: 'top_memes' },
        { name: '⭐ أفضل المساهمين', value: 'contributors' },
        { name: '👥 أكثر المستخدمين نشاطاً', value: 'active' },
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply();

    const guildId = interaction.guildId!;
    const type = interaction.options.getString('type') || 'points';

    let embed: EmbedBuilder;
    let file: AttachmentBuilder | null = null;

    switch (type) {
      case 'points':
        const result = await buildPointsLeaderboard();
        embed = result.embed;
        file = result.file;
        break;
      case 'seasonal':
        embed = await buildSeasonalEmbed();
        break;
      case 'weekly':
        embed = await buildWeeklyEmbed();
        break;
      case 'hall_of_fame':
        embed = buildHallOfFameEmbed();
        break;
      case 'top_memes':
        embed = await buildTopVotedEmbed(guildId);
        break;
      case 'contributors':
        embed = await buildContributorsEmbed(guildId);
        break;
      case 'active':
        embed = await buildActiveUsersEmbed(guildId);
        break;
      default:
        const def = await buildPointsLeaderboard();
        embed = def.embed;
        file = def.file;
    }

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('leaderboard_select')
        .setPlaceholder(t('select.leaderboard.placeholder'))
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('👑 النقاط').setValue('points').setEmoji('👑'),
          new StringSelectMenuOptionBuilder().setLabel('📊 الموسمي').setValue('seasonal').setEmoji('📊'),
          new StringSelectMenuOptionBuilder().setLabel('📈 الأسبوعي').setValue('weekly').setEmoji('📈'),
          new StringSelectMenuOptionBuilder().setLabel('🏛️ قاعة المشاهير').setValue('hall_of_fame').setEmoji('🏛️'),
          new StringSelectMenuOptionBuilder().setLabel(t('select.leaderboard.top.label')).setValue('top_memes').setEmoji('🏆'),
          new StringSelectMenuOptionBuilder().setLabel(t('select.leaderboard.contributors.label')).setValue('contributors').setEmoji('⭐'),
          new StringSelectMenuOptionBuilder().setLabel(t('select.leaderboard.active.label')).setValue('active').setEmoji('👥'),
        )
    );

    if (file) {
      await interaction.editReply({ embeds: [embed], components: [selectRow], files: [file] });
    } else {
      await interaction.editReply({ embeds: [embed], components: [selectRow] });
    }
    logCommand(interaction.user.id, 'leaderboard', guildId, { type });
  } catch (error) {
    logError('Leaderboard command', error);
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.leaderboard'));
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}

async function buildPointsLeaderboard(): Promise<{ embed: EmbedBuilder; file: AttachmentBuilder | null }> {
  const topUsers = getLeaderboardByPoints(10);

  let embed: EmbedBuilder;
  let file: AttachmentBuilder | null = null;

  if (topUsers.length > 0) {
    try {
      const imageBuffer = await generateLeaderboardImage(topUsers);
      file = new AttachmentBuilder(imageBuffer, { name: 'leaderboard.png' });
      embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle(t('leaderboard.points.title'))
        .setImage('attachment://leaderboard.png')
        .setFooter({ text: t('leaderboard.points.footer') })
        .setTimestamp();
    } catch {
      embed = buildFallbackLeaderboard(topUsers);
    }
  } else {
    embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(t('leaderboard.points.title'))
      .setDescription(t('leaderboard.points.empty'))
      .setTimestamp();
  }

  return { embed, file };
}

function buildFallbackLeaderboard(users: import('../types').UserProfile[]): EmbedBuilder {
  const medals = ['🥇', '🥈', '🥉'];
  const description = users.map((u, i) => {
    const medal = medals[i] || `**${i + 1}.**`;
    const crown = u.totalWins > 0 ? ' 👑' : '';
    const unlocked = u.achievements?.filter(a => a.unlockedAt) || [];
    const badges = unlocked.slice(0, 2).map(a => a.emoji).join(' ');
    return `${medal} <@${u.userId}>${crown} — **${u.totalPoints}** نقاط • ${u.totalWins} فوز • ${u.totalSubmissions} إرسال ${badges ? '| ' + badges : ''}`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(t('leaderboard.points.title'))
    .setDescription(description)
    .setFooter({ text: t('leaderboard.points.footer') })
    .setTimestamp();
}

async function buildSeasonalEmbed(): Promise<EmbedBuilder> {
  const season = getActiveSeason();
  const topUsers = getSeasonalLeaderboard(10);
  const medals = ['🥇', '🥈', '🥉'];

  const description = topUsers.length > 0
    ? topUsers.map((u, i) => `${medals[i] || `#${i + 1}`} <@${u.userId}> — **${u.seasonalPoints}** نقاط • ${u.seasonalWins} فوز`).join('\n')
    : t('season.no_data');

  const seasonLine = season ? `📈 **${season.name}** — ${t('season.ends', { date: new Date(season.endDate).toLocaleDateString('ar-SA') })}\n\n` : '';

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle(t('season.leaderboard'))
    .setDescription(seasonLine + description)
    .setTimestamp();

  return embed;
}

async function buildWeeklyEmbed(): Promise<EmbedBuilder> {
  const weekly = getWeeklyLeaderboard(10);
  const medals = ['🥇', '🥈', '🥉'];

  return new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle(t('weekly.leaderboard'))
    .setDescription(
      weekly.length > 0
        ? weekly.map((u, i) => `${medals[i] || `#${i + 1}`} <@${u.userId}> — **${u.weeklyWins}** ${t('common.wins')}`).join('\n')
        : t('leaderboard.seasonal.empty')
    )
    .setFooter({ text: t('leaderboard.weekly.resets') })
    .setTimestamp();
}

function buildHallOfFameEmbed(): EmbedBuilder {
  const entries = getHallOfFame();
  return new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(t('season.hall_of_fame'))
    .setDescription(
      entries.length > 0
        ? entries.slice(0, 15).map((e, i) =>
          `**${i + 1}.** 👑 <@${e.userId}> — **${e.points}** ${t('common.points_abbr')} • ${e.wins} ${t('common.wins')} (*${e.seasonName}*)`
        ).join('\n')
        : t('leaderboard.hall_of_fame.empty')
    )
    .setTimestamp();
}

async function buildTopVotedEmbed(guildId: string): Promise<EmbedBuilder> {
  const topMemes = getTopCommunityMemes(undefined, 10);
  return new EmbedBuilder()
    .setColor(0xF1C40F).setTitle(t('embed.leaderboard.top.title'))
    .setDescription(topMemes.length > 0
      ? topMemes.map((m, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
        return `${medal} 😂 ${m.funny} 🔥 ${m.legendary} ❤️ ${m.likes} | 📊 ${m.score}\n${m.title || 'بدون عنوان'} — <@${m.authorId}>`;
      }).join('\n\n')
      : t('empty.top_memes'))
    .setFooter({ text: t('footer.leaderboard.updates') }).setTimestamp();
}

async function buildContributorsEmbed(guildId: string): Promise<EmbedBuilder> {
  const creators = getTopCreators(10);
  return new EmbedBuilder()
    .setColor(0x9B59B6).setTitle(t('embed.leaderboard.contributors.title'))
    .setDescription(creators.length > 0
      ? creators.map((c, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
        return t('leaderboard.contributors.line', { medal, userId: c.userId, count: c.approved, score: c.score, points: c.points });
      }).join('\n')
      : t('empty.contributors'))
    .setFooter({ text: t('footer.leaderboard.updates') }).setTimestamp();
}

async function buildActiveUsersEmbed(guildId: string): Promise<EmbedBuilder> {
  const activeUsers = await getMostActiveUsers(guildId);
  return new EmbedBuilder()
    .setColor(0x2ECC71).setTitle(t('embed.leaderboard.active.title'))
    .setDescription(activeUsers.length > 0
      ? activeUsers.map((u, i) => t('leaderboard.active.line', { i: i + 1, userId: u.userId, count: u.voteCount })).join('\n')
      : t('empty.active'))
    .setFooter({ text: t('footer.active.based') }).setTimestamp();
}
