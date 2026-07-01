import { addCoins as dbAddCoins } from '../database/users';

export function calculateCoins(difficulty: number): number {
  return 5 + difficulty * 2;
}

export function rewardCoins(userId: string, guildId: string, difficulty: number): number {
  const coins = calculateCoins(difficulty);
  dbAddCoins(userId, guildId, coins);
  return coins;
}
