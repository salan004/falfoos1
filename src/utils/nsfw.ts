import { ChannelType, Channel } from 'discord.js';

export function isNsfwChannel(channel: Channel): boolean {
  if (channel.type === ChannelType.GuildText && 'nsfw' in channel) {
    return (channel as any).nsfw;
  }
  if (channel.type === ChannelType.GuildAnnouncement && 'nsfw' in channel) {
    return (channel as any).nsfw;
  }
  return false;
}

export function canPostNsfw(channel: Channel, memeNsfw: boolean): boolean {
  if (!memeNsfw) return true;
  return isNsfwChannel(channel);
}
