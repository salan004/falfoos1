export interface Question {
  id: number;
  categoryId: number;
  categoryNameAr?: string;
  questionAr: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  difficulty: number;
  source: string | null;
}

export interface AnswerRecord {
  answer: string | null;
  isCorrect: boolean;
  time: number;
  status: 'answered' | 'skipped';
}

export interface VoteRecord {
  answerId: number;
  votedAt: number;
}

export interface QuestionRoundState {
  votes: Map<string, VoteRecord>;
  ended: boolean;
  questionStartedAt: number;
  timerInterval: ReturnType<typeof setInterval> | null;
  endTimeout: ReturnType<typeof setTimeout> | null;
}

export interface ParticipantData {
  userId: string;
  username: string;
  correctCount: number;
  wrongCount: number;
  totalTime: number;
  pointsEarned: number;
  answerSequence: boolean[];
}

export interface RegistrationState {
  messageId: string | null;
  registeredUsers: Set<string>;
  timerInterval: ReturnType<typeof setInterval> | null;
  endTimeout: ReturnType<typeof setTimeout> | null;
}

export interface QuizState {
  guildId: string;
  channelId: string;
  userId: string;
  questions: Question[];
  currentIndex: number;
  totalQuestions: number;
  answers: AnswerRecord[];
  startTime: number;
  status: 'active' | 'completed' | 'cancelled';
  messageId: string | null;
  sessionId: number | null;
  pointsEarned: number;
  coinsEarned: number;
  round: QuestionRoundState | null;
  registration: RegistrationState | null;
  totalRegistered: number;
  registeredUsers: Set<string>;
  participants: Map<string, ParticipantData>;
  preQuizUserSnapshot: {
    points: number;
    coins: number;
    level: number;
    correct_answers: number;
    wrong_answers: number;
    current_streak: number;
  } | null;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  points: number;
  level: number;
  correctAnswers: number;
  wins: number;
}

export interface ImportQuestion {
  question_ar: string;
  category: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correct: 'A' | 'B' | 'C' | 'D';
  difficulty: number;
  source?: string;
}
