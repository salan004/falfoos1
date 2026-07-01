<<<<<<< HEAD
import { Events, Interaction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { findCommunityVote, createCommunityVote, updateCommunityVote, getCommunityVoteStats, getCommunityMemesByCategory, getWeightedRandomMeme, addRecentMeme, getRecentMemeIds, approveSubmission, rejectSubmission, getPendingSubmissions, getApprovedCommunityMemes, getUserStats, isMemeExpired, finalizeMemeVoting } from '../data/store';
import { logCommand, logError } from '../utils/logger';
import { t } from '../utils/i18n';
import { buildMemeEmbed, buildArenaMemeEmbed, arenaVoteButtons, reviewButtons, safeEmbed } from '../utils/embed';
import { fetchMeme } from '../utils/memeApi';
import { canPostNsfw } from '../utils/nsfw';

const VOTE_TYPE_MAP: Record<string, 'funny' | 'legendary' | 'like'> = {
  vote_funny: 'funny',
  vote_legendary: 'legendary',
  vote_like: 'like',
};

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setDescription(t('error.command_not_found', { command: interaction.commandName }));
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      await command.execute(interaction);
    }

    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    }

    if (interaction.isStringSelectMenu()) {
      await handleSelectMenuInteraction(interaction);
    }
  } catch (error) {
    logError('Interaction handler', error, {
      type: interaction.type,
      user: interaction.user?.id,
      guild: interaction.guildId,
    });

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.unexpected'));

    if (interaction.isRepliable()) {
      if (interaction.deferred) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  }
}

async function handleButtonInteraction(interaction: any): Promise<void> {
  const { customId, user, guildId, message } = interaction;

  if (customId.startsWith('vote_')) {
    await handleArenaVote(interaction);
  } else if (customId.startsWith('save_')) {
    await handleSaveButton(interaction);
  } else if (customId.startsWith('fav_')) {
    await handleFavoriteButton(interaction);
  } else if (customId.startsWith('nextmeme_')) {
    await handleNextMeme(interaction);
  } else if (customId.startsWith('next_')) {
    await handleNextCommunityMeme(interaction);
  } else if (customId.startsWith('approve_')) {
    await handleApprove(interaction);
  } else if (customId.startsWith('reject_')) {
    await handleReject(interaction);
  } else if (customId.startsWith('delete_')) {
    await handleDelete(interaction);
  }
}

async function handleArenaVote(interaction: any): Promise<void> {
  const { customId, user, guildId, message } = interaction;
  const parts = customId.split('_');
  const votePrefix = `${parts[0]}_${parts[1]}`;
  const voteType = VOTE_TYPE_MAP[votePrefix];
  const memeId = Buffer.from(parts.slice(2).join('_'), 'base64').toString('utf-8');

  if (!voteType) return;

  if (isMemeExpired(memeId)) {
    finalizeMemeVoting(memeId);
    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setDescription(t('vote.expired'));
    await interaction.reply({ embeds: [embed], ephemeral: true });

    const stats = getCommunityVoteStats(memeId);
    const newExpiredRow = arenaVoteButtons(memeId, stats.funny, stats.legendary, stats.likes, true);
    const encExpId = Buffer.from(memeId).toString('base64');
    const curRows = message.components;
    let expiredRows: any[];
    if (curRows && curRows.length > 0) {
      let replaced = false;
      expiredRows = curRows.map((row: any) => {
        const hasMeme = row.components.some((c: any) => c.customId?.includes(encExpId));
        if (hasMeme) { replaced = true; return newExpiredRow; }
        return row;
      });
      if (!replaced) expiredRows.push(newExpiredRow);
    } else {
      expiredRows = [newExpiredRow];
    }
    await message.edit({ components: expiredRows });
    return;
  }

  const existingVote = findCommunityVote(user.id, memeId, guildId);

  if (existingVote) {
    if (existingVote.voteType === voteType) {
      const key = `vote.already_${voteType}` as const;
      const embed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setDescription(t(key));
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    updateCommunityVote(user.id, memeId, guildId, voteType);

    const key = `vote.changed_${voteType}` as const;
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setDescription(t(key));
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else {
    createCommunityVote(user.id, memeId, guildId, voteType);

    const key = `vote.cast_${voteType}` as const;
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setDescription(t(key));
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  const stats = getCommunityVoteStats(memeId);
  const disabled = isMemeExpired(memeId);
  const newRow = arenaVoteButtons(memeId, stats.funny, stats.legendary, stats.likes, disabled);
  const encId = Buffer.from(memeId).toString('base64');
  const currentRows = message.components;
  let rows: any[];
  if (currentRows && currentRows.length > 0) {
    let replaced = false;
    rows = currentRows.map((row: any) => {
      const hasMeme = row.components.some((c: any) => c.customId?.includes(encId));
      if (hasMeme) { replaced = true; return newRow; }
      return row;
    });
    if (!replaced) rows.push(newRow);
  } else {
    rows = [newRow];
  }
  await message.edit({ components: rows });
  logCommand(user.id, `vote_${voteType}`, guildId, { memeId });
}

async function handleSaveButton(interaction: any): Promise<void> {
  const { customId, user, guildId, message } = interaction;
  const memeUrl = Buffer.from(customId.split('_')[1], 'base64').toString('utf-8');
  const memeTitle = message.embeds[0]?.title?.replace(/^[^\s]+\s/, '') || 'Meme';
  const memeImageUrl = message.embeds[0]?.image?.url || '';
  const memeSource = message.embeds[0]?.footer?.text?.replace(/^Source:\s/, '')?.split('•')[0]?.trim() || 'unknown';
  const category = customId.split('_')[2] || 'random';

  const { findFavorite, createFavorite } = require('../data/store');
  const existing = findFavorite(user.id, memeUrl);

  if (existing) {
    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setDescription(t('error.already_favorited'));
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  createFavorite({
    userId: user.id,
    guildId,
    memeUrl,
    memeTitle,
    memeImageUrl,
    memeSource,
    category,
  });

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setDescription(t('success.favorite_saved'));
  await interaction.reply({ embeds: [embed], ephemeral: true });
  logCommand(user.id, 'save', guildId, { memeUrl });
}

async function handleFavoriteButton(interaction: any): Promise<void> {
  const { customId, user, guildId, message } = interaction;
  const memeId = Buffer.from(customId.split('_')[1], 'base64').toString('utf-8');
  const memeTitle = message.embeds[0]?.title?.replace(/^[^\s]+\s/, '') || 'Meme';
  const memeImageUrl = message.embeds[0]?.image?.url || '';
  const memeUrl = memeImageUrl;

  const { findFavorite, createFavorite } = require('../data/store');
  const existing = findFavorite(user.id, memeUrl);

  if (existing) {
    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setDescription(t('error.already_favorited'));
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  createFavorite({
    userId: user.id,
    guildId,
    memeUrl,
    memeTitle,
    memeImageUrl,
    memeSource: 'community',
    category: 'random',
  });

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setDescription(t('success.favorite_saved'));
  await interaction.reply({ embeds: [embed], ephemeral: true });
  logCommand(user.id, 'fav', guildId, { memeId });
}

async function handleNextMeme(interaction: any): Promise<void> {
  await interaction.deferUpdate();
  const category = interaction.customId.split('_')[1] || 'random';

  const meme = await fetchMeme(category as any);
  if (!meme.imageUrl || meme.source === 'none') {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.no_arabic_memes'));
    await interaction.editReply({ embeds: [embed], components: [] });
    return;
  }

  if (!canPostNsfw(interaction.channel, meme.nsfw)) return;

  const embed = buildMemeEmbed(meme, interaction.user.displayName);
  await interaction.editReply({ embeds: [embed], components: [] });
}

async function handleNextCommunityMeme(interaction: any): Promise<void> {
  await interaction.deferUpdate();
  const category = interaction.customId.split('_')[1] || 'random';

  const excludeIds = getRecentMemeIds(interaction.guildId);
  const meme = getWeightedRandomMeme(category, excludeIds);

  if (!meme) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.no_community_memes'));
    await interaction.editReply({ embeds: [embed], components: [] });
    return;
  }

  addRecentMeme(meme.id, interaction.guildId!);

  const stats = getCommunityVoteStats(meme.id);
  const embed = buildArenaMemeEmbed(meme);
  const buttons = arenaVoteButtons(meme.id, stats.funny, stats.legendary, stats.likes, !meme.voting);
  await interaction.editReply({ embeds: [embed], components: [buttons] });
}

async function handleApprove(interaction: any): Promise<void> {
  if (!interaction.member?.permissions?.has(PermissionFlagsBits.ModerateMembers)) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.not_moderator'));
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  await interaction.deferUpdate();

  const submissionId = Buffer.from(interaction.customId.split('_')[1], 'base64').toString('utf-8');
  const meme = approveSubmission(submissionId);

  if (!meme) {
    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setDescription(t('error.no_pending'));
    await interaction.editReply({ embeds: [embed], components: [] });
    return;
  }

  const { findGuildConfig } = require('../data/store');
  const guildConfig = findGuildConfig(interaction.guildId);

  const approvedEmbed = safeEmbed()
    .setColor(0x00FF00)
    .setTitle(t('ic.approved.title'))
    .setImage(meme.imageUrl)
    .setDescription(meme.title || 'No description provided')
    .addFields(
      { name: t('ic.approved.author'), value: `<@${meme.authorId}>`, inline: true },
      { name: t('ic.approved.voting'), value: t('ic.approved.duration'), inline: true },
    )
    .setFooter(t('ic.approved.footer'))
    .setTimestamp()
    .build();

  await interaction.editReply({ embeds: [approvedEmbed], components: [] });

  if (guildConfig?.memeChannelId) {
    try {
      const memeChannel = interaction.guild?.channels.cache.get(guildConfig.memeChannelId);
      if (memeChannel?.isTextBased()) {
        const arenaEmbed = buildArenaMemeEmbed(meme);
        const voteButtons = arenaVoteButtons(meme.id, 0, 0, 0, false);
        await memeChannel.send({ embeds: [arenaEmbed], components: [voteButtons] });
      }
    } catch (err) {
      logError('Failed to post approved meme to arena channel', err);
    }
  }

  try {
    const author = await interaction.client.users.fetch(meme.authorId);
    const dmEmbed = safeEmbed()
      .setColor(0x00FF00)
      .setTitle(t('ic.dm_approved.title'))
      .setImage(meme.imageUrl)
      .setDescription(t('ic.dm_approved.desc'))
      .build();
    await author.send({ embeds: [dmEmbed] }).catch(() => {});
  } catch { }

  logCommand(interaction.user.id, 'approve', interaction.guildId, { submissionId });
}

async function handleReject(interaction: any): Promise<void> {
  if (!interaction.member?.permissions?.has(PermissionFlagsBits.ModerateMembers)) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.not_moderator'));
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  await interaction.deferUpdate();

  const submissionId = Buffer.from(interaction.customId.split('_')[1], 'base64').toString('utf-8');
  const rejected = rejectSubmission(submissionId);

  if (!rejected) {
    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setDescription(t('error.no_pending'));
    await interaction.editReply({ embeds: [embed], components: [] });
    return;
  }

  const rejectedEmbed = safeEmbed()
    .setColor(0xFF0000)
    .setDescription(t('ic.rejected.desc'))
    .build();

  await interaction.editReply({ embeds: [rejectedEmbed], components: [] });

  try {
    const { getPendingSubmissionById } = require('../data/store');
    const sub = getPendingSubmissionById(submissionId);
    if (sub) {
      const author = await interaction.client.users.fetch(sub.authorId);
      const dmEmbed = safeEmbed()
        .setColor(0xFF0000)
        .setTitle(t('ic.dm_rejected.title'))
        .setDescription(t('ic.dm_rejected.desc'))
        .build();
      await author.send({ embeds: [dmEmbed] }).catch(() => {});
    }
  } catch { }

  logCommand(interaction.user.id, 'reject', interaction.guildId, { submissionId });
}

async function handleDelete(interaction: any): Promise<void> {
  if (!interaction.member?.permissions?.has(PermissionFlagsBits.ModerateMembers)) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.not_moderator'));
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  await interaction.deferUpdate();

  const submissionId = Buffer.from(interaction.customId.split('_')[1], 'base64').toString('utf-8');
  const { rejectSubmission } = require('../data/store');
  rejectSubmission(submissionId);

  const deletedEmbed = safeEmbed()
    .setColor(0xFF0000)
    .setDescription(t('ic.deleted.desc'))
    .build();

  await interaction.editReply({ embeds: [deletedEmbed], components: [] });
  logCommand(interaction.user.id, 'delete', interaction.guildId, { submissionId });
}

async function handleSelectMenuInteraction(interaction: any): Promise<void> {
  if (interaction.customId === 'leaderboard_select') {
    await interaction.deferUpdate();

    const { getTopVotedMemes, getTopContributors, getMostActiveUsers } = require('../services/leaderboardService');

    const value = interaction.values[0];
    let embed: EmbedBuilder;

    switch (value) {
      case 'top_memes': {
        const topMemes = await getTopVotedMemes(interaction.guildId);
        embed = new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle(t('embed.leaderboard.top.title'))
          .setDescription(
            topMemes.length > 0
              ? topMemes.map((m: any, i: number) =>
                `**${i + 1}.** 👍 ${m.upvotes} | 👎 ${m.downvotes}\n➡️ الميم التالي`
              ).join('\n\n')
              : t('empty.top_memes')
          )
          .setFooter({ text: t('footer.leaderboard.updates') })
          .setTimestamp();
        break;
      }
      case 'contributors': {
        const contributors = await getTopContributors(interaction.guildId);
        embed = new EmbedBuilder()
          .setColor(0x9B59B6)
          .setTitle(t('embed.leaderboard.contributors.title'))
          .setDescription(
            contributors.length > 0
              ? contributors.map((c: any, i: number) =>
                `**${i + 1}.** <@${c.userId}> — ${c.count} ${c.count !== 1 ? 'ميمات محفوظة' : 'ميم محفوظ'}`
              ).join('\n')
              : t('empty.contributors')
          )
          .setFooter({ text: t('footer.contributors.based') })
          .setTimestamp();
        break;
      }
      case 'active': {
        const activeUsers = await getMostActiveUsers(interaction.guildId);
        embed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle(t('embed.leaderboard.active.title'))
          .setDescription(
            activeUsers.length > 0
              ? activeUsers.map((u: any, i: number) =>
                `**${i + 1}.** <@${u.userId}> — ${u.voteCount} ${u.voteCount !== 1 ? 'تصويتات' : 'تصويت'}`
              ).join('\n')
              : t('empty.active')
          )
          .setFooter({ text: t('footer.active.based') })
          .setTimestamp();
        break;
      }
      default:
        return;
    }

    await interaction.editReply({ embeds: [embed], components: interaction.message.components });
  }
=======
import { Events, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { client } from '../client';
import { handleQuizCommand } from '../commands/quiz';
import { handleLeaderboardCommand } from '../commands/leaderboard';
import { handleProfileCommand } from '../commands/profile';
import { handleRankCommand } from '../commands/rank';
import { handleSkipCommand } from '../commands/skip';
import { handleAddQuestion } from '../commands/admin/addQuestion';
import { handleEditQuestion } from '../commands/admin/editQuestion';
import { handleDeleteQuestion } from '../commands/admin/deleteQuestion';
import { handleImportJson } from '../commands/admin/importJson';
import { handleExportJson } from '../commands/admin/exportJson';
import { handleSetupCommand, handleSettingsCommand } from '../commands/admin/setup';
import { handleReloadCommand } from '../commands/admin/reload';
import { handlePermissionsCommand } from '../commands/admin/permissions';

export function registerInteractionEvent(): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const commandMap: Record<string, (i: ChatInputCommandInteraction) => Promise<void>> = {
          'مسابقة': handleQuizCommand,
          'quiz': handleQuizCommand,
          'المتصدرون': handleLeaderboardCommand,
          'leaderboard': handleLeaderboardCommand,
          'ملفي': handleProfileCommand,
          'profile': handleProfileCommand,
          'rank': handleRankCommand,
          'skip': handleSkipCommand,
          'إضافة_سؤال': handleAddQuestion,
          'addquestion': handleAddQuestion,
          'تعديل_سؤال': handleEditQuestion,
          'editquestion': handleEditQuestion,
          'حذف_سؤال': handleDeleteQuestion,
          'removequestion': handleDeleteQuestion,
          'استيراد': handleImportJson,
          'import': handleImportJson,
          'تصدير': handleExportJson,
          'export': handleExportJson,
          'setup': handleSetupCommand,
          'settings': handleSettingsCommand,
          'reload': handleReloadCommand,
          'permissions': handlePermissionsCommand,
        };

        const handler = commandMap[interaction.commandName];
        if (handler) {
          await handler(interaction);
        }
      }
    } catch (error) {
      console.error('❌ Interaction handler error:', error);
      if (interaction.isRepliable()) {
        const errMsg = 'An unexpected error occurred. Please try again.';
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: errMsg }).catch(() => {});
        } else {
          await interaction.reply({ content: errMsg, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
      }
    }
  });
>>>>>>> 7a303d754a86e399d51568f3e72b09aa6c8bd1df
}
