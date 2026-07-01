import fs from 'fs';
import path from 'path';
import { GuildConfigData, MemeCategory, MemeData, MemeSourceType, CommunityMeme, PendingSubmission, UserProfile, UserStats, VoteType, Achievement, AchievementId, SeasonData, HallOfFameEntry, WinningRound } from '../types';
import { validateCommunityMeme, validatePendingSubmission, validateCachedMeme, repairArray } from '../utils/validation';
import logger from '../utils/logger';

const DATA_DIR = path.join(process.cwd(), 'data');

const ACHIEVEMENT_DEFS: { id: AchievementId; name: string; description: string; emoji: string }[] = [
  { id: 'first_win', name: 'First Victory', description: 'Win your first meme in the arena', emoji: '🏆' },
  { id: 'five_wins', name: '5 Wins', description: 'Win 5 memes in the arena', emoji: '🔥' },
  { id: 'meme_king', name: 'Meme King', description: 'Win 10 memes in the arena', emoji: '👑' },
  { id: 'hundred_votes', name: '100 Total Votes', description: 'Receive 100 total votes on your memes', emoji: '💯' },
  { id: 'top_contributor', name: 'Top Contributor', description: 'Submit 10 memes to the arena', emoji: '⭐' },
  { id: 'vote_legend', name: 'Vote Legend', description: 'Receive 1000 total votes on your memes', emoji: '🌟' },
  { id: 'legendary_moment', name: 'Legendary Moment', description: 'Get 10 Legendary votes on a single meme', emoji: '⚡' },
];

interface VoteRecord {
  userId: string;
  guildId: string;
  memeUrl: string;
  voteType: 'upvote' | 'downvote';
  createdAt: string;
}

interface FavoriteRecord {
  userId: string;
  guildId: string;
  memeUrl: string;
  memeTitle: string;
  memeImageUrl: string;
  memeSource: string;
  category: string;
  savedAt: string;
}

interface CommunityVoteRecord {
  userId: string;
  memeId: string;
  guildId: string;
  voteType: VoteType;
  createdAt: string;
}

const votes = new Map<string, VoteRecord>();
const favorites = new Map<string, FavoriteRecord>();
const guildConfigs = new Map<string, GuildConfigData>();
const memeCache = new Map<string, string[]>();

export interface CachedMeme extends Omit<MemeData, 'category'> {
  category: string;
  sourceType: MemeSourceType;
  cachedAt: string;
}

const approvedCache = new Map<string, CachedMeme[]>();
const FALLBACK_MEMES_PATH = path.join(process.cwd(), 'src', 'data', 'arabic-memes.json');

let communityMemes: CommunityMeme[] = [];
let pendingSubmissions: PendingSubmission[] = [];
let userProfiles: UserProfile[] = [];
let seasons: SeasonData[] = [];
let hallOfFame: HallOfFameEntry[] = [];
let winningRounds: WinningRound[] = [];
const guildRecentMemes = new Map<string, string[]>();
let globalRecentMemes: string[] = [];
const communityVotes = new Map<string, CommunityVoteRecord>();

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function voteKey(userId: string, memeUrl: string, guildId: string): string {
  return `${userId}|${memeUrl}|${guildId}`;
}

function favoriteKey(userId: string, memeUrl: string): string {
  return `${userId}|${memeUrl}`;
}

function communityVoteKey(userId: string, memeId: string, guildId: string): string {
  return `${userId}|${memeId}|${guildId}`;
}

function loadVotes(): void {
  try {
    const filePath = path.join(DATA_DIR, 'votes.json');
    if (fs.existsSync(filePath)) {
      const data: VoteRecord[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      for (const record of data) {
        votes.set(voteKey(record.userId, record.memeUrl, record.guildId), record);
      }
    }
  } catch { }
}

function saveVotes(): void {
  try {
    ensureDataDir();
    fs.writeFileSync(path.join(DATA_DIR, 'votes.json'), JSON.stringify(Array.from(votes.values()), null, 2), 'utf-8');
  } catch { }
}

function loadFavorites(): void {
  try {
    const filePath = path.join(DATA_DIR, 'favorites.json');
    if (fs.existsSync(filePath)) {
      const data: FavoriteRecord[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      for (const record of data) {
        favorites.set(favoriteKey(record.userId, record.memeUrl), record);
      }
    }
  } catch { }
}

function saveFavorites(): void {
  try {
    ensureDataDir();
    fs.writeFileSync(path.join(DATA_DIR, 'favorites.json'), JSON.stringify(Array.from(favorites.values()), null, 2), 'utf-8');
  } catch { }
}

function loadGuildConfigs(): void {
  try {
    const filePath = path.join(DATA_DIR, 'guildConfigs.json');
    if (fs.existsSync(filePath)) {
      const data: any[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      for (const record of data) {
        const config: GuildConfigData = {
          ...record,
          lastAutoPost: record.lastAutoPost ? new Date(record.lastAutoPost) : null,
        };
        guildConfigs.set(record.guildId, config);
      }
    }
  } catch { }
}

function saveGuildConfigs(): void {
  try {
    ensureDataDir();
    const data = Array.from(guildConfigs.values()).map(c => ({ ...c, lastAutoPost: c.lastAutoPost ? c.lastAutoPost.toISOString() : null }));
    fs.writeFileSync(path.join(DATA_DIR, 'guildConfigs.json'), JSON.stringify(data, null, 2), 'utf-8');
  } catch { }
}

function loadApprovedCache(): void {
  try {
    const filePath = path.join(DATA_DIR, 'approved-cache.json');
    if (fs.existsSync(filePath)) {
      const raw: unknown[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const result = repairArray(raw, validateCachedMeme, 'Approved cache');
      for (const w of result.warnings) logger.warn(w);
      for (const meme of result.clean) {
        const m = meme as unknown as CachedMeme;
        const cat = m.category || 'random';
        if (!approvedCache.has(cat)) approvedCache.set(cat, []);
        approvedCache.get(cat)!.push(m);
      }
    }
  } catch { }
}

function saveApprovedCache(): void {
  try {
    ensureDataDir();
    const all: CachedMeme[] = [];
    for (const memes of approvedCache.values()) all.push(...memes);
    const valid = all
      .map(m => validateCachedMeme(m))
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .map(m => m as unknown as CachedMeme);
    fs.writeFileSync(path.join(DATA_DIR, 'approved-cache.json'), JSON.stringify(valid.slice(-500), null, 2), 'utf-8');
  } catch { }
}

function loadCommunityMemes(): void {
  try {
    const filePath = path.join(DATA_DIR, 'memes.json');
    if (fs.existsSync(filePath)) {
      const raw: unknown[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const result = repairArray(raw, validateCommunityMeme, 'Community memes');
      for (const w of result.warnings) logger.warn(w);
      communityMemes = result.clean;
    }
  } catch { }
}

function saveCommunityMemes(): void {
  try {
    ensureDataDir();
    communityMemes = communityMemes
      .map(m => validateCommunityMeme(m))
      .filter((m): m is CommunityMeme => m !== null);
    fs.writeFileSync(path.join(DATA_DIR, 'memes.json'), JSON.stringify(communityMemes, null, 2), 'utf-8');
  } catch { }
}

function loadPendingSubmissions(): void {
  try {
    const filePath = path.join(DATA_DIR, 'pending-memes.json');
    if (fs.existsSync(filePath)) {
      const raw: unknown[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const result = repairArray(raw, validatePendingSubmission, 'Pending submissions');
      for (const w of result.warnings) logger.warn(w);
      pendingSubmissions = result.clean;
    }
  } catch { }
}

function savePendingSubmissions(): void {
  try {
    ensureDataDir();
    pendingSubmissions = pendingSubmissions
      .map(s => validatePendingSubmission(s))
      .filter((s): s is PendingSubmission => s !== null);
    fs.writeFileSync(path.join(DATA_DIR, 'pending-memes.json'), JSON.stringify(pendingSubmissions, null, 2), 'utf-8');
  } catch { }
}

function loadUserProfiles(): void {
  try {
    const filePath = path.join(DATA_DIR, 'user-profiles.json');
    if (fs.existsSync(filePath)) {
      userProfiles = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch { }
}

function saveUserProfiles(): void {
  try {
    ensureDataDir();
    fs.writeFileSync(path.join(DATA_DIR, 'user-profiles.json'), JSON.stringify(userProfiles, null, 2), 'utf-8');
  } catch { }
}

function loadSeasons(): void {
  try {
    const filePath = path.join(DATA_DIR, 'seasons.json');
    if (fs.existsSync(filePath)) {
      seasons = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch { }
}

function saveSeasons(): void {
  try {
    ensureDataDir();
    fs.writeFileSync(path.join(DATA_DIR, 'seasons.json'), JSON.stringify(seasons, null, 2), 'utf-8');
  } catch { }
}

function loadHallOfFame(): void {
  try {
    const filePath = path.join(DATA_DIR, 'hall-of-fame.json');
    if (fs.existsSync(filePath)) {
      hallOfFame = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch { }
}

function saveHallOfFame(): void {
  try {
    ensureDataDir();
    fs.writeFileSync(path.join(DATA_DIR, 'hall-of-fame.json'), JSON.stringify(hallOfFame, null, 2), 'utf-8');
  } catch { }
}

function loadWinningRounds(): void {
  try {
    const filePath = path.join(DATA_DIR, 'winning-rounds.json');
    if (fs.existsSync(filePath)) {
      winningRounds = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch { }
}

function saveWinningRounds(): void {
  try {
    ensureDataDir();
    fs.writeFileSync(path.join(DATA_DIR, 'winning-rounds.json'), JSON.stringify(winningRounds, null, 2), 'utf-8');
  } catch { }
}

function loadRecentMemes(): void {
  try {
    const filePath = path.join(DATA_DIR, 'recent-memes.json');
    if (fs.existsSync(filePath)) {
      const data: { guildRecent: Record<string, string[]>; globalRecent: string[] } = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (data.guildRecent) {
        for (const [guildId, ids] of Object.entries(data.guildRecent)) guildRecentMemes.set(guildId, ids);
      }
      if (data.globalRecent) globalRecentMemes = data.globalRecent;
    }
  } catch { }
}

function saveRecentMemes(): void {
  try {
    ensureDataDir();
    const guildRecent: Record<string, string[]> = {};
    for (const [guildId, ids] of guildRecentMemes) guildRecent[guildId] = ids;
    fs.writeFileSync(path.join(DATA_DIR, 'recent-memes.json'), JSON.stringify({ guildRecent, globalRecent: globalRecentMemes }, null, 2), 'utf-8');
  } catch { }
}

function loadCommunityVotes(): void {
  try {
    const filePath = path.join(DATA_DIR, 'community-votes.json');
    if (fs.existsSync(filePath)) {
      const data: CommunityVoteRecord[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      for (const record of data) {
        communityVotes.set(communityVoteKey(record.userId, record.memeId, record.guildId), record);
      }
    }
  } catch { }
}

function saveCommunityVotes(): void {
  try {
    ensureDataDir();
    fs.writeFileSync(path.join(DATA_DIR, 'community-votes.json'), JSON.stringify(Array.from(communityVotes.values()), null, 2), 'utf-8');
  } catch { }
}

export function initDataStore(): void {
  loadVotes();
  loadFavorites();
  loadGuildConfigs();
  loadApprovedCache();
  loadCommunityMemes();
  loadPendingSubmissions();
  loadUserProfiles();
  loadSeasons();
  loadHallOfFame();
  loadWinningRounds();
  loadRecentMemes();
  loadCommunityVotes();

  migrateLegacyMemes();
  ensureActiveSeason();
}

function migrateLegacyMemes(): void {
  for (const meme of communityMemes) {
    if ((meme as any).placement === undefined) {
      (meme as any).placement = null;
    }
  }
  saveCommunityMemes();
}

function ensureActiveSeason(): void {
  const now = new Date();
  const hasActive = seasons.some(s => s.active);
  if (!hasActive) {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    seasons.push({
      id: `season_${now.getFullYear()}_${now.getMonth() + 1}`,
      name: `${monthNames[now.getMonth()]} ${now.getFullYear()}`,
      startDate: startOfMonth.toISOString(),
      endDate: endOfMonth.toISOString(),
      active: true,
    });
    saveSeasons();
  }
}

export function getActiveSeason(): SeasonData | null {
  return seasons.find(s => s.active) || null;
}

export function checkSeasonRollover(): void {
  const active = getActiveSeason();
  if (!active) return;

  const now = new Date();
  const end = new Date(active.endDate);
  if (now > end) {
    finalizeSeason(active.id);
    ensureActiveSeason();
  }
}

function finalizeSeason(seasonId: string): void {
  const season = seasons.find(s => s.id === seasonId);
  if (!season) return;

  season.active = false;

  const topUsers = getSeasonalLeaderboard(10);
  for (const user of topUsers) {
    hallOfFame.push({
      seasonId: season.id,
      seasonName: season.name,
      userId: user.userId,
      username: user.username,
      points: user.totalPoints,
      wins: user.totalWins,
      achievedAt: new Date().toISOString(),
    });
  }

  for (const profile of userProfiles) {
    profile.seasonalPoints = 0;
    profile.seasonalWins = 0;
  }

  saveSeasons();
  saveHallOfFame();
  saveUserProfiles();
}

export function getHallOfFame(): HallOfFameEntry[] {
  return [...hallOfFame].sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime());
}

export function getSeasonalLeaderboard(limit: number = 10): UserProfile[] {
  return [...userProfiles]
    .filter(u => u.seasonalPoints > 0 || u.seasonalWins > 0)
    .sort((a, b) => b.seasonalPoints - a.seasonalPoints || b.seasonalWins - a.seasonalWins)
    .slice(0, limit);
}

export function getWeeklyLeaderboard(limit: number = 10): { userId: string; username: string; weeklyWins: number }[] {
  return [...userProfiles]
    .filter(u => u.weeklyWins > 0)
    .sort((a, b) => b.weeklyWins - a.weeklyWins)
    .slice(0, limit)
    .map(u => ({ userId: u.userId, username: u.username, weeklyWins: u.weeklyWins }));
}

export function resetWeeklyWins(): void {
  for (const profile of userProfiles) {
    profile.weeklyWins = 0;
  }
  saveUserProfiles();
}

export function getAchievementDefinitions(): { id: AchievementId; name: string; description: string; emoji: string }[] {
  return ACHIEVEMENT_DEFS;
}

export function checkAchievements(userId: string): Achievement[] {
  const profile = getUserProfile(userId);
  const newAchievements: Achievement[] = [];

  for (const def of ACHIEVEMENT_DEFS) {
    const already = profile.achievements.find(a => a.id === def.id);
    if (already && already.unlockedAt) continue;

    let earned = false;

    switch (def.id) {
      case 'first_win':
        earned = profile.totalWins >= 1;
        break;
      case 'five_wins':
        earned = profile.totalWins >= 5;
        break;
      case 'meme_king':
        earned = profile.totalWins >= 10;
        break;
      case 'hundred_votes':
        earned = profile.totalVotesReceived >= 100;
        break;
      case 'top_contributor':
        earned = profile.totalSubmissions >= 10;
        break;
      case 'vote_legend':
        earned = profile.totalVotesReceived >= 1000;
        break;
      case 'legendary_moment': {
        const memes = communityMemes.filter(m => m.authorId === userId);
        earned = memes.some(m => m.legendary >= 10);
        break;
      }
    }

    if (earned) {
      const achievement: Achievement = { ...def, unlockedAt: new Date().toISOString() };
      if (already) {
        already.unlockedAt = achievement.unlockedAt;
      } else {
        profile.achievements.push(achievement);
      }
      newAchievements.push(achievement);
    }
  }

  saveUserProfiles();
  return newAchievements;
}

export function getUserProfile(userId: string): UserProfile {
  let profile = userProfiles.find(p => p.userId === userId);
  if (!profile) {
    profile = {
      userId,
      username: '',
      avatarUrl: '',
      totalPoints: 0,
      totalWins: 0,
      totalSubmissions: 0,
      achievements: [],
      seasonalPoints: 0,
      seasonalWins: 0,
      weeklyWins: 0,
      totalVotesReceived: 0,
    };
    userProfiles.push(profile);
    saveUserProfiles();
  }
  return profile;
}

export function updateUserProfile(userId: string, updates: Partial<UserProfile>): UserProfile {
  const profile = getUserProfile(userId);
  Object.assign(profile, updates);
  saveUserProfiles();
  return profile;
}

export function incrementUserSubmissions(userId: string): void {
  const profile = getUserProfile(userId);
  profile.totalSubmissions += 1;
  saveUserProfiles();
}

export function getTop3ForRound(): { meme: CommunityMeme; rank: number }[] {
  const voting = communityMemes
    .filter(m => m.voting && m.expiresAt && new Date(m.expiresAt) <= new Date())
    .sort((a, b) => b.score - a.score);

  return voting.slice(0, 3).map((meme, i) => ({ meme, rank: i + 1 }));
}

export function getWinningRounds(): WinningRound[] {
  return [...winningRounds].sort((a, b) => new Date(b.finalizedAt).getTime() - new Date(a.finalizedAt).getTime()).slice(0, 20);
}

export function awardPlacements(): { meme: CommunityMeme; rank: number }[] {
  const allVoting = communityMemes.filter(m => m.voting && m.expiresAt);
  const finished = allVoting.filter(m => new Date(m.expiresAt!) <= new Date());
  const sorted = finished.sort((a, b) => b.score - a.score);
  const top3 = sorted.slice(0, 3);

  for (let i = 0; i < top3.length; i++) {
    top3[i].voting = false;
    top3[i].expiresAt = null;
    top3[i].placement = i + 1;
  }

  for (let i = 3; i < sorted.length; i++) {
    sorted[i].voting = false;
    sorted[i].expiresAt = null;
    sorted[i].placement = null;
  }

  const round: WinningRound = {
    memeId: top3[0]?.id || '',
    firstPlace: top3[0] ? { userId: top3[0].authorId, memeId: top3[0].id, score: top3[0].score } : null,
    secondPlace: top3[1] ? { userId: top3[1].authorId, memeId: top3[1].id, score: top3[1].score } : null,
    thirdPlace: top3[2] ? { userId: top3[2].authorId, memeId: top3[2].id, score: top3[2].score } : null,
    finalizedAt: new Date().toISOString(),
  };
  winningRounds.push(round);
  saveWinningRounds();

  if (top3[0]) {
    const profile = getUserProfile(top3[0].authorId);
    profile.totalPoints += 1;
    profile.totalWins += 1;
    profile.seasonalPoints += 1;
    profile.seasonalWins += 1;
    profile.weeklyWins += 1;
    top3[0].winner = true;
  }
  if (top3[1]) {
    const profile = getUserProfile(top3[1].authorId);
    profile.seasonalPoints += 0;
  }
  if (top3[2]) {
    const profile = getUserProfile(top3[2].authorId);
    profile.seasonalPoints += 0;
  }

  saveCommunityMemes();
  saveUserProfiles();

  return top3.map((meme, i) => ({ meme, rank: i + 1 }));
}

export function updateTotalVotesReceived(userId: string, amount: number = 1): void {
  const profile = getUserProfile(userId);
  profile.totalVotesReceived += amount;
  saveUserProfiles();
}

export function findVote(userId: string, memeUrl: string, guildId: string): VoteRecord | null {
  return votes.get(voteKey(userId, memeUrl, guildId)) || null;
}

export function createVote(userId: string, guildId: string, memeUrl: string, voteType: 'upvote' | 'downvote'): VoteRecord {
  const record: VoteRecord = { userId, guildId, memeUrl, voteType, createdAt: new Date().toISOString() };
  votes.set(voteKey(userId, memeUrl, guildId), record);
  saveVotes();
  return record;
}

export function updateVote(userId: string, memeUrl: string, guildId: string, voteType: 'upvote' | 'downvote'): VoteRecord | null {
  const key = voteKey(userId, memeUrl, guildId);
  const record = votes.get(key);
  if (record) { record.voteType = voteType; saveVotes(); return record; }
  return null;
}

export function countVotes(memeUrl: string, guildId: string, voteType: 'upvote' | 'downvote'): number {
  let count = 0;
  for (const record of votes.values()) {
    if (record.memeUrl === memeUrl && record.guildId === guildId && record.voteType === voteType) count++;
  }
  return count;
}

export function getVoteStats(memeUrl: string, guildId: string): { upvotes: number; downvotes: number } {
  let upvotes = 0, downvotes = 0;
  for (const record of votes.values()) {
    if (record.memeUrl === memeUrl && record.guildId === guildId) {
      if (record.voteType === 'upvote') upvotes++; else downvotes++;
    }
  }
  return { upvotes, downvotes };
}

export function getAllVotesInGuild(guildId: string): VoteRecord[] {
  const result: VoteRecord[] = [];
  for (const record of votes.values()) {
    if (record.guildId === guildId) result.push(record);
  }
  return result;
}

export function findFavorite(userId: string, memeUrl: string): FavoriteRecord | null {
  return favorites.get(favoriteKey(userId, memeUrl)) || null;
}

export function createFavorite(data: Omit<FavoriteRecord, 'savedAt'>): FavoriteRecord {
  const record: FavoriteRecord = { ...data, savedAt: new Date().toISOString() };
  favorites.set(favoriteKey(data.userId, data.memeUrl), record);
  saveFavorites();
  return record;
}

export function getFavorites(userId: string, guildId: string): FavoriteRecord[] {
  const result: FavoriteRecord[] = [];
  for (const record of favorites.values()) {
    if (record.userId === userId && record.guildId === guildId) result.push(record);
  }
  return result.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function getAllFavoritesInGuild(guildId: string): FavoriteRecord[] {
  const result: FavoriteRecord[] = [];
  for (const record of favorites.values()) {
    if (record.guildId === guildId) result.push(record);
  }
  return result;
}

export function findGuildConfig(guildId: string): GuildConfigData | null {
  return guildConfigs.get(guildId) || null;
}

export function upsertGuildConfig(guildId: string, updates: Partial<GuildConfigData>): GuildConfigData {
  let config = guildConfigs.get(guildId);
  if (!config) {
    config = {
      guildId, channelId: null, reviewChannelId: null, memeChannelId: null, announcementChannelId: null,
      autoPostEnabled: false, autoPostInterval: 'hourly', cooldown: 5, lastAutoPost: null,
    };
  }
  Object.assign(config, updates);
  guildConfigs.set(guildId, config);
  saveGuildConfigs();
  return config;
}

export function getEnabledGuildConfigs(): GuildConfigData[] {
  return Array.from(guildConfigs.values()).filter(c => c.autoPostEnabled);
}

export function getAllGuildConfigs(): GuildConfigData[] {
  return Array.from(guildConfigs.values());
}

export function getSeenUrls(category: string): Set<string> {
  return new Set(memeCache.get(category) || []);
}

export function addSeenUrl(url: string, category: string): void {
  if (!memeCache.has(category)) memeCache.set(category, []);
  const urls = memeCache.get(category)!;
  if (!urls.includes(url)) { urls.unshift(url); if (urls.length > 20) urls.pop(); }
}

export function addCachedMeme(meme: { title: string; url: string; imageUrl: string; source: string; sourceType: MemeSourceType; category: string; nsfw: boolean; author?: string; ups?: number }): void {
  const cat = meme.category || 'random';
  if (!approvedCache.has(cat)) approvedCache.set(cat, []);
  const cache = approvedCache.get(cat)!;
  if (!cache.some(m => m.imageUrl === meme.imageUrl)) {
    cache.push({ ...meme, category: cat, sourceType: meme.sourceType || 'international', cachedAt: new Date().toISOString() });
    if (cache.length > 100) cache.splice(0, cache.length - 100);
    saveApprovedCache();
  }
}

export function getCachedMeme(category: string): CachedMeme | null {
  const cache = approvedCache.get(category);
  if (!cache || cache.length === 0) return null;
  const unseen = cache.filter(m => !memeCache.get(category)?.includes(m.imageUrl));
  const pool = unseen.length > 0 ? unseen : cache;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  if (!memeCache.has(category)) memeCache.set(category, []);
  const seen = memeCache.get(category)!;
  if (!seen.includes(chosen.imageUrl)) { seen.unshift(chosen.imageUrl); if (seen.length > 20) seen.pop(); }
  return chosen;
}

export function hasCachedMemes(category: string): boolean {
  const cache = approvedCache.get(category);
  return !!cache && cache.length > 0;
}

export function getFallbackMemes(category: string): CachedMeme | null {
  try {
    if (fs.existsSync(FALLBACK_MEMES_PATH)) {
      const data: any[] = JSON.parse(fs.readFileSync(FALLBACK_MEMES_PATH, 'utf-8'));
      let pool = data.filter(m => m.category === category);
      if (pool.length === 0) pool = data;
      if (pool.length > 0) {
        const entry = pool[Math.floor(Math.random() * pool.length)];
        return { title: entry.title, url: entry.image, imageUrl: entry.image, source: 'arabic-memes', sourceType: 'local' as MemeSourceType, category: (entry.category || 'random') as MemeCategory, nsfw: entry.nsfw || false, cachedAt: new Date().toISOString() };
      }
    }
  } catch { }
  return null;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export function getCommunityMemes(): CommunityMeme[] { return communityMemes; }

export function getCommunityMemesByCategory(category: string): CommunityMeme[] {
  if (!category || category === 'random') return communityMemes;
  return communityMemes.filter(m => m.category === category && m.approved);
}

export function getApprovedCommunityMemes(category?: string): CommunityMeme[] {
  const approved = communityMemes.filter(m => m.approved);
  if (category && category !== 'random') return approved.filter(m => m.category === category);
  return approved;
}

export function getCommunityMemeById(id: string): CommunityMeme | null {
  return communityMemes.find(m => m.id === id) || null;
}

export function getPendingSubmissions(): PendingSubmission[] { return pendingSubmissions; }

export function getPendingSubmissionById(id: string): PendingSubmission | null {
  return pendingSubmissions.find(s => s.id === id) || null;
}

export function addPendingSubmission(data: { authorId: string; imageUrl: string; title: string; category: MemeCategory }): PendingSubmission {
  const submission: PendingSubmission = { id: generateId(), authorId: data.authorId, imageUrl: data.imageUrl, title: data.title, category: data.category, submittedAt: new Date().toISOString() };
  pendingSubmissions.push(submission);
  savePendingSubmissions();
  return submission;
}

export function approveSubmission(id: string): CommunityMeme | null {
  const index = pendingSubmissions.findIndex(s => s.id === id);
  if (index === -1) return null;
  const submission = pendingSubmissions[index];
  pendingSubmissions.splice(index, 1);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const meme: CommunityMeme = {
    id: submission.id, authorId: submission.authorId, imageUrl: submission.imageUrl, title: submission.title,
    category: submission.category, funny: 0, legendary: 0, likes: 0, score: 0, approved: true, voting: true,
    winner: false, placement: null, createdAt: new Date().toISOString(), expiresAt,
  };
  communityMemes.push(meme);
  savePendingSubmissions();
  saveCommunityMemes();
  return meme;
}

export function rejectSubmission(id: string): boolean {
  const index = pendingSubmissions.findIndex(s => s.id === id);
  if (index === -1) return false;
  pendingSubmissions.splice(index, 1);
  savePendingSubmissions();
  return true;
}

export function deleteCommunityMeme(id: string): boolean {
  const index = communityMemes.findIndex(m => m.id === id);
  if (index === -1) return false;
  communityMemes.splice(index, 1);
  saveCommunityMemes();
  return true;
}

export function isMemeExpired(memeId: string): boolean {
  const meme = communityMemes.find(m => m.id === memeId);
  if (!meme || !meme.expiresAt) return false;
  return new Date(meme.expiresAt) <= new Date();
}

export function finalizeMemeVoting(memeId: string): CommunityMeme | null {
  const meme = communityMemes.find(m => m.id === memeId);
  if (!meme) return null;
  meme.voting = false;
  meme.expiresAt = null;
  saveCommunityMemes();
  return meme;
}

export function updateCommunityMemeVotes(memeId: string, deltaFunny: number, deltaLegendary: number, deltaLikes: number): CommunityMeme | null {
  const meme = communityMemes.find(m => m.id === memeId);
  if (!meme) return null;
  meme.funny = Math.max(0, meme.funny + deltaFunny);
  meme.legendary = Math.max(0, meme.legendary + deltaLegendary);
  meme.likes = Math.max(0, meme.likes + deltaLikes);
  meme.score = meme.funny * 1 + meme.legendary * 3 + meme.likes * 2;
  saveCommunityMemes();
  return meme;
}

export function findCommunityVote(userId: string, memeId: string, guildId: string): CommunityVoteRecord | null {
  return communityVotes.get(communityVoteKey(userId, memeId, guildId)) || null;
}

export function createCommunityVote(userId: string, memeId: string, guildId: string, voteType: VoteType): CommunityVoteRecord {
  const record: CommunityVoteRecord = { userId, memeId, guildId, voteType, createdAt: new Date().toISOString() };
  communityVotes.set(communityVoteKey(userId, memeId, guildId), record);
  const dF = voteType === 'funny' ? 1 : 0, dL = voteType === 'legendary' ? 1 : 0, dLi = voteType === 'like' ? 1 : 0;
  updateCommunityMemeVotes(memeId, dF, dL, dLi);
  saveCommunityVotes();
  return record;
}

export function updateCommunityVote(userId: string, memeId: string, guildId: string, voteType: VoteType): CommunityVoteRecord | null {
  const key = communityVoteKey(userId, memeId, guildId);
  const existing = communityVotes.get(key);
  if (!existing) return null;
  const old = existing.voteType;
  existing.voteType = voteType;
  const uF = (old === 'funny' ? -1 : 0) + (voteType === 'funny' ? 1 : 0);
  const uL = (old === 'legendary' ? -1 : 0) + (voteType === 'legendary' ? 1 : 0);
  const uLi = (old === 'like' ? -1 : 0) + (voteType === 'like' ? 1 : 0);
  updateCommunityMemeVotes(memeId, uF, uL, uLi);
  saveCommunityVotes();
  return existing;
}

export function getCommunityVoteStats(memeId: string): { funny: number; legendary: number; likes: number; score: number } {
  const meme = communityMemes.find(m => m.id === memeId);
  if (!meme) return { funny: 0, legendary: 0, likes: 0, score: 0 };
  return { funny: meme.funny, legendary: meme.legendary, likes: meme.likes, score: meme.score };
}

export function addRecentMeme(memeId: string, guildId: string): void {
  if (!guildRecentMemes.has(guildId)) guildRecentMemes.set(guildId, []);
  const guildList = guildRecentMemes.get(guildId)!;
  if (!guildList.includes(memeId)) { guildList.unshift(memeId); if (guildList.length > 50) guildList.pop(); }
  if (!globalRecentMemes.includes(memeId)) { globalRecentMemes.unshift(memeId); if (globalRecentMemes.length > 100) globalRecentMemes.pop(); }
  saveRecentMemes();
}

export function getRecentMemeIds(guildId: string): Set<string> {
  return new Set([...(guildRecentMemes.get(guildId) || []), ...globalRecentMemes]);
}

export function getWeightedRandomMeme(category?: string, excludeIds?: Set<string>): CommunityMeme | null {
  let pool = getApprovedCommunityMemes(category).filter(m => m.score >= -10 && m.voting);
  if (excludeIds && excludeIds.size > 0) {
    const filtered = pool.filter(m => !excludeIds.has(m.id));
    if (filtered.length > 0) pool = filtered;
  }
  if (pool.length === 0) return null;
  const minScore = Math.min(...pool.map(m => m.score));
  const offset = Math.abs(Math.min(0, minScore)) + 1;
  const weights = pool.map(m => Math.max(1, m.score + offset));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * totalWeight;
  for (let i = 0; i < pool.length; i++) { rand -= weights[i]; if (rand <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

export function getUserSubmissionCountToday(userId: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();
  const pendingToday = pendingSubmissions.filter(s => s.authorId === userId && s.submittedAt >= todayStr).length;
  const memesToday = communityMemes.filter(m => m.authorId === userId && m.createdAt >= todayStr).length;
  return pendingToday + memesToday;
}

export function isDuplicateImage(imageUrl: string): boolean {
  return [...pendingSubmissions, ...communityMemes].some(s => s.imageUrl === imageUrl);
}

export function getUserStats(userId: string): UserStats {
  const submittedMemes = communityMemes.filter(m => m.authorId === userId);
  const approved = submittedMemes.filter(m => m.approved);
  const profile = getUserProfile(userId);
  let likesReceived = 0, score = 0;
  for (const meme of submittedMemes) { likesReceived += meme.likes; score += meme.score; }
  return { submitted: submittedMemes.length, approved: approved.length, likesReceived, score, wins: profile.totalWins, points: profile.totalPoints };
}

export function getUserMemeHistory(userId: string): CommunityMeme[] {
  return communityMemes.filter(m => m.authorId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getUserRank(userId: string): { rank: number; totalUsers: number } {
  const sorted = getLeaderboardByPoints();
  const index = sorted.findIndex(e => e.userId === userId);
  return { rank: index === -1 ? sorted.length + 1 : index + 1, totalUsers: sorted.length };
}

export function getLeaderboardByPoints(limit: number = 10): UserProfile[] {
  return [...userProfiles].sort((a, b) => b.totalPoints - a.totalPoints || b.totalWins - a.totalWins).slice(0, limit);
}

export function getTopCommunityMemes(category?: string, limit: number = 10): CommunityMeme[] {
  let pool = communityMemes.filter(m => m.approved);
  if (category && category !== 'random') pool = pool.filter(m => m.category === category);
  return pool.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function getTopVotingMemes(limit: number = 3): CommunityMeme[] {
  return communityMemes
    .filter(m => m.voting && m.expiresAt)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getTopCreators(limit: number = 10): { userId: string; approved: number; score: number; points: number }[] {
  const grouped = new Map<string, { approved: number; score: number; points: number }>();
  for (const meme of communityMemes) {
    if (!meme.approved) continue;
    const existing = grouped.get(meme.authorId);
    if (existing) { existing.approved++; existing.score += meme.score; }
    else { grouped.set(meme.authorId, { approved: 1, score: meme.score, points: 0 }); }
  }
  for (const [userId, data] of grouped) {
    const profile = getUserProfile(userId);
    data.points = profile.totalPoints;
  }
  return Array.from(grouped.entries()).map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.points - a.points || b.score - a.score).slice(0, limit);
}

export function getActiveVotingMemes(): CommunityMeme[] {
  return communityMemes.filter(m => m.voting && m.expiresAt);
}

export function getExpiredVotingMemes(): CommunityMeme[] {
  const now = new Date();
  return communityMemes.filter(m => m.voting && m.expiresAt && new Date(m.expiresAt) <= now);
}

export function getServerStats(): { totalMemes: number; totalUsers: number; totalVotes: number; activeVotings: number; totalPoints: number } {
  const totalMemes = communityMemes.filter(m => m.approved).length;
  const totalUsers = new Set(communityMemes.filter(m => m.approved).map(m => m.authorId)).size;
  const totalVotes = communityVotes.size;
  const activeVotings = communityMemes.filter(m => m.voting).length;
  const totalPoints = userProfiles.reduce((sum, p) => sum + p.totalPoints, 0);
  return { totalMemes, totalUsers, totalVotes, activeVotings, totalPoints };
}

export function getServerLeaderboard(): CommunityMeme[] {
  return communityMemes.filter(m => m.approved).sort((a, b) => b.score - a.score).slice(0, 20);
}

export function getActiveVotingCount(): number {
  return communityMemes.filter(m => m.voting).length;
}
