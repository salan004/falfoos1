import { queryOne, queryAll, execute, beginTransaction, commitTransaction, rollbackTransaction, execInTransaction } from './helpers';

export function upsertUser(userId: string, guildId: string, username: string): void {
  const existing = queryOne('SELECT 1 FROM users WHERE user_id = ? AND guild_id = ?', [userId, guildId]);

  if (existing) {
    execute('UPDATE users SET username = ? WHERE user_id = ? AND guild_id = ?', [username, userId, guildId]);
  } else {
    execute(
      'INSERT INTO users (user_id, guild_id, username) VALUES (?, ?, ?)',
      [userId, guildId, username],
    );
  }
}

export function addPoints(userId: string, guildId: string, points: number): void {
  execute('UPDATE users SET points = points + ? WHERE user_id = ? AND guild_id = ?', [points, userId, guildId]);
}

export function addCoins(userId: string, guildId: string, coins: number): void {
  execute('UPDATE users SET coins = coins + ? WHERE user_id = ? AND guild_id = ?', [coins, userId, guildId]);
}

export function addCorrectAnswer(userId: string, guildId: string): void {
  execute('UPDATE users SET correct_answers = correct_answers + 1 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
}

export function addWrongAnswer(userId: string, guildId: string): void {
  execute('UPDATE users SET wrong_answers = wrong_answers + 1 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
}

export function incrementTotalQuizzes(userId: string, guildId: string): void {
  execute('UPDATE users SET total_quizzes = total_quizzes + 1 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
}

export function setLevel(userId: string, guildId: string, level: number): void {
  execute('UPDATE users SET level = ? WHERE user_id = ? AND guild_id = ?', [level, userId, guildId]);
}

export function getUser(userId: string, guildId: string) {
  const row = queryOne('SELECT * FROM users WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  if (!row) return undefined;

  return {
    user_id: row.user_id as string,
    guild_id: row.guild_id as string,
    username: row.username as string,
    points: row.points as number,
    coins: row.coins as number,
    level: row.level as number,
    correct_answers: row.correct_answers as number,
    wrong_answers: row.wrong_answers as number,
    total_quizzes: row.total_quizzes as number,
    current_streak: (row.current_streak as number) || 0,
    best_streak: (row.best_streak as number) || 0,
    first_place: (row.first_place as number) || 0,
    second_place: (row.second_place as number) || 0,
    third_place: (row.third_place as number) || 0,
    total_wins: (row.total_wins as number) || 0,
  };
}

export function updateUserStreak(userId: string, guildId: string, currentStreak: number, bestStreak: number): void {
  execute(
    'UPDATE users SET current_streak = ?, best_streak = ? WHERE user_id = ? AND guild_id = ?',
    [currentStreak, bestStreak, userId, guildId],
  );
}

export function incrementUserPlacement(userId: string, guildId: string, position: number): void {
  if (position === 1) {
    execute('UPDATE users SET first_place = first_place + 1, total_wins = total_wins + 1 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  } else if (position === 2) {
    execute('UPDATE users SET second_place = second_place + 1 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  } else if (position === 3) {
    execute('UPDATE users SET third_place = third_place + 1 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  }
}

export function upsertUserInTransaction(userId: string, guildId: string, username: string): void {
  const existing = queryOne('SELECT 1 FROM users WHERE user_id = ? AND guild_id = ?', [userId, guildId]);

  if (existing) {
    execInTransaction('UPDATE users SET username = ? WHERE user_id = ? AND guild_id = ?', [username, userId, guildId]);
  } else {
    execInTransaction(
      'INSERT INTO users (user_id, guild_id, username) VALUES (?, ?, ?)',
      [userId, guildId, username],
    );
  }
}

export function incrementUserPlacementInTransaction(userId: string, guildId: string, position: number): void {
  if (position === 1) {
    execInTransaction('UPDATE users SET first_place = first_place + 1, total_wins = total_wins + 1 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  } else if (position === 2) {
    execInTransaction('UPDATE users SET second_place = second_place + 1 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  } else if (position === 3) {
    execInTransaction('UPDATE users SET third_place = third_place + 1 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  }
}

export function getLeaderboard(guildId: string, limit: number, offset: number) {
  const rows = queryAll(
    `SELECT user_id, username, points, level, correct_answers, wrong_answers, first_place
     FROM users
     WHERE guild_id = ?
     ORDER BY points DESC
     LIMIT ? OFFSET ?`,
    [guildId, limit, offset],
  );

  return rows.map(r => ({
    user_id: r.user_id as string,
    username: r.username as string,
    points: r.points as number,
    level: r.level as number,
    correct_answers: r.correct_answers as number,
    wrong_answers: (r.wrong_answers as number) || 0,
    first_place: (r.first_place as number) || 0,
  }));
}

export function getLeaderboardCount(guildId: string): number {
  const row = queryOne('SELECT COUNT(*) as count FROM users WHERE guild_id = ?', [guildId]);
  return (row?.count as number) || 0;
}

export function getUserRank(userId: string, guildId: string): { rank: number; totalPlayers: number } | null {
  const user = getUser(userId, guildId);
  if (!user) return null;

  const totalPlayers = getLeaderboardCount(guildId);
  const row = queryOne(
    `SELECT COUNT(*) + 1 as rank
     FROM users
     WHERE guild_id = ? AND (
       points > ? OR (points = ? AND correct_answers > ?) OR (points = ? AND correct_answers = ? AND user_id < ?)
     )`,
    [guildId, user.points, user.points, user.correct_answers, user.points, user.correct_answers, userId],
  );

  return {
    rank: (row?.rank as number) || 1,
    totalPlayers,
  };
}
