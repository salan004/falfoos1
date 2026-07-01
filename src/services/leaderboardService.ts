import { getAllVotesInGuild, getAllFavoritesInGuild } from '../data/store';

export function getTopVotedMemes(guildId: string, limit: number = 10): { memeUrl: string; upvotes: number; downvotes: number; total: number }[] {
  const guildVotes = getAllVotesInGuild(guildId);

  const grouped = new Map<string, { upvotes: number; downvotes: number; total: number }>();

  for (const vote of guildVotes) {
    let entry = grouped.get(vote.memeUrl);
    if (!entry) {
      entry = { upvotes: 0, downvotes: 0, total: 0 };
      grouped.set(vote.memeUrl, entry);
    }
    if (vote.voteType === 'upvote') entry.upvotes++;
    else entry.downvotes++;
    entry.total++;
  }

  return Array.from(grouped.entries())
    .map(([memeUrl, stats]) => ({ memeUrl, ...stats }))
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, limit);
}

export function getTopContributors(guildId: string, limit: number = 10): { userId: string; count: number }[] {
  const guildFavorites = getAllFavoritesInGuild(guildId);

  const grouped = new Map<string, number>();

  for (const fav of guildFavorites) {
    grouped.set(fav.userId, (grouped.get(fav.userId) || 0) + 1);
  }

  return Array.from(grouped.entries())
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getMostActiveUsers(guildId: string, limit: number = 10): { userId: string; voteCount: number }[] {
  const guildVotes = getAllVotesInGuild(guildId);

  const grouped = new Map<string, number>();

  for (const vote of guildVotes) {
    grouped.set(vote.userId, (grouped.get(vote.userId) || 0) + 1);
  }

  return Array.from(grouped.entries())
    .map(([userId, voteCount]) => ({ userId, voteCount }))
    .sort((a, b) => b.voteCount - a.voteCount)
    .slice(0, limit);
}
