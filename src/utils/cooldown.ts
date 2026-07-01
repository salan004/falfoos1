import { Collection } from 'discord.js';
import { findGuildConfig } from '../data/store';
import logger from './logger';

const cooldowns = new Collection<string, Collection<string, number>>();

export function checkCooldown(
  userId: string,
  commandName: string,
  guildId: string
): { onCooldown: boolean; remainingSeconds: number } {
  const guildConfig = findGuildConfig(guildId);
  const cooldownSeconds = guildConfig?.cooldown ?? 5;

  const key = `${commandName}`;
  if (!cooldowns.has(key)) {
    cooldowns.set(key, new Collection());
  }

  const timestamps = cooldowns.get(key)!;
  const now = Date.now();
  const cooldownAmount = cooldownSeconds * 1000;

  if (timestamps.has(userId)) {
    const expirationTime = timestamps.get(userId)! + cooldownAmount;
    if (now < expirationTime) {
      const remaining = Math.ceil((expirationTime - now) / 1000);
      return { onCooldown: true, remainingSeconds: remaining };
    }
  }

  timestamps.set(userId, now);
  setTimeout(() => timestamps.delete(userId), cooldownAmount);

  return { onCooldown: false, remainingSeconds: 0 };
}

export function clearCooldowns(): void {
  cooldowns.clear();
  logger.info('All cooldowns cleared');
}
