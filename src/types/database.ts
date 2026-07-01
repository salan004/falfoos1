export interface CategoryRow {
  id: number;
  name_ar: string;
  name_en: string;
}

export interface QuestionRow {
  id: number;
  category_id: number;
  question_ar: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  difficulty: number;
  source: string | null;
  created_at: string;
}

export interface UserRow {
  user_id: string;
  guild_id: string;
  username: string;
  points: number;
  coins: number;
  level: number;
  correct_answers: number;
  wrong_answers: number;
  total_quizzes: number;
  current_streak: number;
  best_streak: number;
  first_place: number;
  second_place: number;
  third_place: number;
  total_wins: number;
  created_at: string;
}

export interface QuizSessionRow {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  question_id: number;
  status: 'waiting' | 'active' | 'completed' | 'timed_out';
  started_at: string;
  ended_at: string | null;
}

export interface QuizAnswerRow {
  id: number;
  session_id: number;
  user_id: string;
  selected_answer: string;
  is_correct: boolean;
  answered_at: string;
}

export interface QuizParticipantRow {
  id: number;
  session_id: number;
  user_id: string;
  correct_count: number;
  wrong_count: number;
  total_time: number;
  points_earned: number;
  position: number;
}
