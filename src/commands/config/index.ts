import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, TextChannel } from 'discord.js';
import { findGuildConfig, upsertGuildConfig } from '../../data/store';
import { AutoPostInterval } from '../../types';
import { logCommand, logError } from '../../utils/logger';
import { stopGuildSchedule, scheduleGuild } from '../../services/autoPoster';
import { t } from '../../utils/i18n';

const intervalLabels: Record<string, string> = {
  hourly: 'كل ساعة',
  '3hours': 'كل 3 ساعات',
  '6hours': 'كل 6 ساعات',
  '12hours': 'كل 12 ساعة',
  daily: 'كل يوم',
};

export const data = new SlashCommandBuilder()
  .setName(t('cmd.config.name'))
  .setDescription(t('cmd.config.desc'))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub
      .setName(t('cmd.config.sub.set-channel.name'))
      .setDescription(t('cmd.config.sub.set-channel.desc'))
      .addChannelOption(option =>
        option
          .setName(t('cmd.config.sub.set-channel.opt.channel.name'))
          .setDescription(t('cmd.config.sub.set-channel.opt.channel.desc'))
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName(t('cmd.config.sub.set-interval.name'))
      .setDescription(t('cmd.config.sub.set-interval.desc'))
      .addStringOption(option =>
        option
          .setName(t('cmd.config.sub.set-interval.opt.interval.name'))
          .setDescription(t('cmd.config.sub.set-interval.opt.interval.desc'))
          .setRequired(true)
          .addChoices(
            { name: t('cmd.config.choice.hourly'), value: 'hourly' },
            { name: t('cmd.config.choice.3hours'), value: '3hours' },
            { name: t('cmd.config.choice.6hours'), value: '6hours' },
            { name: t('cmd.config.choice.12hours'), value: '12hours' },
            { name: t('cmd.config.choice.daily'), value: 'daily' },
          )
      )
  )
  .addSubcommand(sub =>
    sub
      .setName(t('cmd.config.sub.enable.name'))
      .setDescription(t('cmd.config.sub.enable.desc'))
  )
  .addSubcommand(sub =>
    sub
      .setName(t('cmd.config.sub.disable.name'))
      .setDescription(t('cmd.config.sub.disable.desc'))
  )
  .addSubcommand(sub =>
    sub
      .setName(t('cmd.config.sub.set-cooldown.name'))
      .setDescription(t('cmd.config.sub.set-cooldown.desc'))
      .addIntegerOption(option =>
        option
          .setName(t('cmd.config.sub.set-cooldown.opt.seconds.name'))
          .setDescription(t('cmd.config.sub.set-cooldown.opt.seconds.desc'))
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(3600)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName(t('cmd.config.sub.show.name'))
      .setDescription(t('cmd.config.sub.show.desc'))
  )
  .addSubcommand(sub =>
    sub
      .setName(t('cmd.config.sub.set-review-channel.name'))
      .setDescription(t('cmd.config.sub.set-review-channel.desc'))
      .addChannelOption(option =>
        option
          .setName(t('cmd.config.sub.set-review-channel.opt.channel.name'))
          .setDescription(t('cmd.config.sub.set-review-channel.opt.channel.desc'))
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('تعيين-قناة-الميم')
      .setDescription('تعيين قناة ساحة الميم العامة')
      .addChannelOption(option =>
        option
          .setName('القناة')
          .setDescription('قناة النص لعرض الميمات المعتمدة')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('تعيين-قناة-الإعلانات')
      .setDescription('تعيين قناة الإعلانات')
      .addChannelOption(option =>
        option
          .setName('القناة')
          .setDescription('قناة النص لإعلانات الساحة')
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.permission'));
    await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'set-channel':
        await handleSetChannel(interaction);
        break;
      case 'set-interval':
        await handleSetInterval(interaction);
        break;
      case 'enable':
        await handleEnable(interaction);
        break;
      case 'disable':
        await handleDisable(interaction);
        break;
      case 'set-cooldown':
        await handleSetCooldown(interaction);
        break;
      case 'show':
        await handleShow(interaction);
        break;
      case 'set-review-channel':
        await handleSetReviewChannel(interaction);
        break;
      case 'تعيين-قناة-الميم':
        await handleSetMemeChannel(interaction);
        break;
      case 'تعيين-قناة-الإعلانات':
        await handleSetAnnouncementChannel(interaction);
        break;
    }
  } catch (error) {
    logError(`config ${subcommand}`, error);
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.config'));
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] });
    }
  }
}

async function handleSetChannel(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: ['Ephemeral'] });

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
  logCommand(interaction.user.id, 'config set-channel', interaction.guildId!, { channelId: channel.id });
}

async function handleSetInterval(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: ['Ephemeral'] });

  const interval = interaction.options.getString('الفاصل') as AutoPostInterval;
  if (!interval || !intervalLabels[interval]) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.invalid_interval'));
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const client = interaction.client;

  upsertGuildConfig(interaction.guildId!, { autoPostInterval: interval });

  stopGuildSchedule(interaction.guildId!);
  if (client.isReady()) {
    scheduleGuild(client, interaction.guildId!);
  }

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setDescription(t('success.interval_set', { interval: intervalLabels[interval] }));
  await interaction.editReply({ embeds: [embed] });
  logCommand(interaction.user.id, 'config set-interval', interaction.guildId!, { interval });
}

async function handleEnable(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: ['Ephemeral'] });

  const guildConfig = findGuildConfig(interaction.guildId!);
  if (!guildConfig || !guildConfig.channelId) {
    const embed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setDescription(t('error.no_channel'));
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const client = interaction.client;

  upsertGuildConfig(interaction.guildId!, { autoPostEnabled: true });

  if (client.isReady()) {
    scheduleGuild(client, interaction.guildId!);
  }

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setDescription(t('success.enabled'));
  await interaction.editReply({ embeds: [embed] });
  logCommand(interaction.user.id, 'config enable', interaction.guildId!);
}

async function handleDisable(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: ['Ephemeral'] });

  upsertGuildConfig(interaction.guildId!, { autoPostEnabled: false });

  stopGuildSchedule(interaction.guildId!);

  const embed = new EmbedBuilder()
    .setColor(0xFFA500)
    .setDescription(t('success.disabled'));
  await interaction.editReply({ embeds: [embed] });
  logCommand(interaction.user.id, 'config disable', interaction.guildId!);
}

async function handleSetCooldown(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: ['Ephemeral'] });

  const seconds = interaction.options.getInteger('الثواني', true);

  upsertGuildConfig(interaction.guildId!, { cooldown: seconds });

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setDescription(t('success.cooldown_set', { seconds }));
  await interaction.editReply({ embeds: [embed] });
  logCommand(interaction.user.id, 'config set-cooldown', interaction.guildId!, { seconds });
}

async function handleShow(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: ['Ephemeral'] });

  const guildConfig = findGuildConfig(interaction.guildId!);

  const channelMention = guildConfig?.channelId ? `<#${guildConfig.channelId}>` : t('config.not_set');
  const reviewChannelMention = guildConfig?.reviewChannelId ? `<#${guildConfig.reviewChannelId}>` : t('config.not_set');
  const memeChannelMention = guildConfig?.memeChannelId ? `<#${guildConfig.memeChannelId}>` : t('config.not_set');
  const announcementChannelMention = guildConfig?.announcementChannelId ? `<#${guildConfig.announcementChannelId}>` : t('config.not_set');
  const status = guildConfig?.autoPostEnabled ? t('config.enabled') : t('config.disabled');
  const intervalDisplay = guildConfig?.autoPostInterval
    ? intervalLabels[guildConfig.autoPostInterval]
    : t('config.not_set');
  const cooldown = guildConfig?.cooldown ?? 5;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(t('embed.config.title'))
    .addFields(
      { name: t('config.channel'), value: channelMention, inline: true },
      { name: t('config.meme_channel'), value: memeChannelMention, inline: true },
      { name: t('config.review_channel'), value: reviewChannelMention, inline: true },
      { name: t('config.announcement_channel'), value: announcementChannelMention, inline: true },
      { name: t('config.status'), value: status, inline: true },
      { name: t('config.interval'), value: intervalDisplay, inline: true },
      { name: t('config.cooldown'), value: `${cooldown} ثانية`, inline: true },
    )
    .setFooter({ text: t('footer.config.guild', { id: interaction.guildId! }) })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
  logCommand(interaction.user.id, 'config show', interaction.guildId!);
}

async function handleSetAnnouncementChannel(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: ['Ephemeral'] });

  const channel = interaction.options.getChannel('القناة') as TextChannel;
  if (!channel || !channel.isTextBased()) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.invalid_channel'));
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  upsertGuildConfig(interaction.guildId!, { announcementChannelId: channel.id });

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setDescription(t('config.success.announcement_channel_set', { channel: channel.toString() }));
  await interaction.editReply({ embeds: [embed] });
  logCommand(interaction.user.id, 'config set-announcement-channel', interaction.guildId!, { channelId: channel.id });
}

async function handleSetMemeChannel(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: ['Ephemeral'] });

  const channel = interaction.options.getChannel('القناة') as TextChannel;
  if (!channel || !channel.isTextBased()) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.invalid_channel'));
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  upsertGuildConfig(interaction.guildId!, { memeChannelId: channel.id });

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setDescription(t('config.success.meme_channel_set', { channel: channel.toString() }));
  await interaction.editReply({ embeds: [embed] });
  logCommand(interaction.user.id, 'config set-meme-channel', interaction.guildId!, { channelId: channel.id });
}

async function handleSetReviewChannel(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: ['Ephemeral'] });

  const channel = interaction.options.getChannel('القناة') as TextChannel;
  if (!channel || !channel.isTextBased()) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setDescription(t('error.invalid_channel'));
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  upsertGuildConfig(interaction.guildId!, { reviewChannelId: channel.id });

  const embed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setDescription(t('success.review_channel_set', { channel: channel.toString() }));
  await interaction.editReply({ embeds: [embed] });
  logCommand(interaction.user.id, 'config set-review-channel', interaction.guildId!, { channelId: channel.id });
}
