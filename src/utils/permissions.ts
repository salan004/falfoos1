import { GuildMember, PermissionsBitField } from 'discord.js';
import { config } from '../config';

export function isAdmin(member: GuildMember): boolean {
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  if (config.adminRoleId && member.roles.cache.has(config.adminRoleId)) return true;
  return false;
}

export function memberHasAdminAccess(
  member: GuildMember | null,
  permissions: Readonly<PermissionsBitField> | null,
  ownerId: string | undefined,
  userId: string,
): boolean {
  if (userId === ownerId) return true;
  if (permissions?.has(PermissionsBitField.Flags.Administrator)) return true;
  if (member instanceof GuildMember && isAdmin(member)) return true;
  return false;
}
