import { Question } from '../types/quiz';

export const ANSWER_LETTERS = ['A', 'B', 'C', 'D'] as const;
export type AnswerLetter = (typeof ANSWER_LETTERS)[number];

export const LETTER_LABELS: Record<AnswerLetter, string> = {
  A: 'أ',
  B: 'ب',
  C: 'ج',
  D: 'د',
};

export const ANSWER_ID_MAP: Record<AnswerLetter, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
};

export const ANSWER_ID_TO_LETTER: Record<number, AnswerLetter> = {
  1: 'A',
  2: 'B',
  3: 'C',
  4: 'D',
};

export function getQuestionOptions(question: Question): Record<AnswerLetter, string> {
  return {
    A: question.optionA,
    B: question.optionB,
    C: question.optionC,
    D: question.optionD,
  };
}

export function getCorrectAnswerLabel(question: Question): string {
  return getQuestionOptions(question)[question.correctAnswer];
}

export function truncatePollText(text: string, maxLength = 55): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

export function formatDurationMs(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds} seconds`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}
