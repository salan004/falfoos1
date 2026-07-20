import { Collection } from 'discord.js';

export type MemeCategory = 'arabic' | 'gaming' | 'discord' | 'school' | 'internet' | 'random';

export type AutoPostInterval = 'hourly' | '3hours' | '6hours' | '12hours' | 'daily';

export type MemeSourceType = 'arabic' | 'international' | 'local' | 'api' | 'reddit' | 'community';

export type VoteType = 'funny' | 'legendary' | 'like';

export type MemeStatus = 'pending' | 'approved' | 'voting' | 'completed';

export type AchievementId = 'first_win' | 'five_wins' | 'meme_king' | 'hundred_votes' | 'top_contributor' | 'vote_legend' | 'legendary_moment';

export interface Achievement {
  id: AchievementId;
  name: string;
  description: string;
  emoji: string;
  unlockedAt: string | null;
}

export interface MemeData {
  title: string;
  url: string;
  imageUrl: string;
  source: string;
  sourceType: MemeSourceType;
  category: MemeCategory;
  nsfw: boolean;
  author?: string;
  ups?: number;
}

export interface CommunityMeme {
  id: string;
  authorId: string;
  imageUrl: string;
  title: string;
  category: MemeCategory;
  funny: number;
  legendary: number;
  likes: number;
  score: number;
  approved: boolean;
  voting: boolean;
  winner: boolean;
  placement: number | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface PendingSubmission {
  id: string;
  authorId: string;
  imageUrl: string;
  title: string;
  category: MemeCategory;
  submittedAt: string;
}

export interface UserProfile {
  userId: string;
  username: string;
  avatarUrl: string;
  totalPoints: number;
  totalWins: number;
  totalSubmissions: number;
  achievements: Achievement[];
  seasonalPoints: number;
  seasonalWins: number;
  weeklyWins: number;
  totalVotesReceived: number;
}

export interface SeasonData {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  active: boolean;
}

export interface HallOfFameEntry {
  seasonId: string;
  seasonName: string;
  userId: string;
  username: string;
  points: number;
  wins: number;
  achievedAt: string;
}

export interface WinningRound {
  memeId: string;
  firstPlace: { userId: string; memeId: string; score: number } | null;
  secondPlace: { userId: string; memeId: string; score: number } | null;
  thirdPlace: { userId: string; memeId: string; score: number } | null;
  finalizedAt: string;
}

export interface GuildConfigData {
  guildId: string;
  channelId: string | null;
  reviewChannelId: string | null;
  memeChannelId: string | null;
  announcementChannelId: string | null;
  autoPostEnabled: boolean;
  autoPostInterval: AutoPostInterval;
  cooldown: number;
  dailySubmitLimit: number;
  lastAutoPost: Date | null;
}

export interface LeaderboardEntry {
  userId: string;
  memesPosted: number;
  upvotesReceived: number;
  downvotesReceived: number;
  totalVotesReceived: number;
}

export interface VoteStats {
  funny: number;
  legendary: number;
  likes: number;
  total: number;
}

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, Command>;
    cooldowns: Collection<string, Collection<string, number>>;
  }
}

export interface Command {
  data: any;
  execute: (interaction: any) => Promise<void>;
}

export interface PaginationData {
  embeds: any[];
  currentPage: number;
  totalPages: number;
  userId: string;
  timeout: NodeJS.Timeout | null;
}

export interface UserStats {
  submitted: number;
  approved: number;
  likesReceived: number;
  score: number;
  wins: number;
  points: number;
}
