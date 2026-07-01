import 'dotenv/config';

export const config = {
  token: process.env.BOT_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  guildId: process.env.GUILD_ID || '',
  adminRoleId: process.env.ADMIN_ROLE_ID || '',
  quizTimeLimit: 30_000,
  speedBonusWindow: 10_000,
  pointsPerCorrect: (difficulty: number) => 10 + difficulty * 5,
  speedBonusPoints: 5,
  coinsPerCorrect: (difficulty: number) => 5 + difficulty * 2,
  levelFormula: (level: number) => level * level * 50,
  quizCooldown: 5_000,
  maxQuestionsPerQuiz: 20,
  leaderboardPageSize: 10,
  pointsFirstPlace: 10,
  pointsSecondPlace: 5,
  pointsThirdPlace: 3,
  pointsCorrectAnswer: 1,
};
