import { GuildMember, PermissionsBitField } from 'discord.js';
import { config } from '../config';

export function isAdmin(member: GuildMember): boolean {
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  if (config.adminRoleId && member.roles.cache.has(config.adminRoleId)) return true;
  return false;
}
