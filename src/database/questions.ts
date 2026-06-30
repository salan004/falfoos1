import { queryOne, queryAll, execute, executeInsert } from './helpers';
import { Question } from '../types/quiz';

const GENERAL_CATEGORY_EN = 'General';

export function isGeneralCategory(categoryId: number): boolean {
  const row = queryOne('SELECT name_en FROM categories WHERE id = ?', [categoryId]);
  return row?.name_en === GENERAL_CATEGORY_EN;
}

export function getGeneralCategoryName(): string {
  return GENERAL_CATEGORY_EN;
}

export function getRandomQuestion(categoryId?: number): Question | null {
  let sql = `
    SELECT q.*, c.name_ar as category_name
    FROM questions q
    JOIN categories c ON c.id = q.category_id
  `;
  const params: unknown[] = [];

  if (categoryId && !isGeneralCategory(categoryId)) {
    sql += ' WHERE q.category_id = ?';
    params.push(categoryId);
  }

  sql += ' ORDER BY RANDOM() LIMIT 1';

  const row = queryOne(sql, params);
  if (!row) return null;

  return mapRow(row);
}

export function getQuestionById(id: number): Question | null {
  const row = queryOne(`
    SELECT q.*, c.name_ar as category_name
    FROM questions q
    JOIN categories c ON c.id = q.category_id
    WHERE q.id = ?
  `, [id]);

  return row ? mapRow(row) : null;
}

export function addQuestion(
  categoryId: number,
  questionAr: string,
  optionA: string,
  optionB: string,
  optionC: string,
  optionD: string,
  correctAnswer: 'A' | 'B' | 'C' | 'D',
  difficulty: number,
  source?: string,
): number {
  return executeInsert(
    `INSERT INTO questions (category_id, question_ar, option_a, option_b, option_c, option_d, correct_answer, difficulty, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [categoryId, questionAr, optionA, optionB, optionC, optionD, correctAnswer, difficulty, source || null],
  );
}

export function updateQuestion(
  id: number,
  categoryId: number,
  questionAr: string,
  optionA: string,
  optionB: string,
  optionC: string,
  optionD: string,
  correctAnswer: 'A' | 'B' | 'C' | 'D',
  difficulty: number,
  source?: string,
): boolean {
  const changes = execute(
    `UPDATE questions
     SET category_id = ?, question_ar = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?,
         correct_answer = ?, difficulty = ?, source = ?
     WHERE id = ?`,
    [categoryId, questionAr, optionA, optionB, optionC, optionD, correctAnswer, difficulty, source || null, id],
  );
  return changes > 0;
}

export function deleteQuestion(id: number): boolean {
  const changes = execute('DELETE FROM questions WHERE id = ?', [id]);
  return changes > 0;
}

export function countQuestions(categoryId?: number): number {
  if (categoryId) {
    const row = queryOne('SELECT COUNT(*) as count FROM questions WHERE category_id = ?', [categoryId]);
    return (row?.count as number) || 0;
  }
  const row = queryOne('SELECT COUNT(*) as count FROM questions');
  return (row?.count as number) || 0;
}

export function getAllQuestions(categoryId?: number): Question[] {
  let sql = `
    SELECT q.*, c.name_ar as category_name
    FROM questions q
    JOIN categories c ON c.id = q.category_id
  `;
  const params: unknown[] = [];

  if (categoryId) {
    sql += ' WHERE q.category_id = ?';
    params.push(categoryId);
  }

  sql += ' ORDER BY q.id';

  const rows = queryAll(sql, params);
  return rows.map(mapRow);
}

export function bulkImportQuestions(
  questions: { categoryId: number; questionAr: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: 'A' | 'B' | 'C' | 'D'; difficulty: number; source?: string }[],
): number {
  let count = 0;
  for (const q of questions) {
    executeInsert(
      `INSERT INTO questions (category_id, question_ar, option_a, option_b, option_c, option_d, correct_answer, difficulty, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [q.categoryId, q.questionAr, q.optionA, q.optionB, q.optionC, q.optionD, q.correctAnswer, q.difficulty, q.source || null],
    );
    count++;
  }
  return count;
}

export function getCategories(): { id: number; name_ar: string; name_en: string }[] {
  const rows = queryAll('SELECT id, name_ar, name_en FROM categories ORDER BY id');
  return rows.map(r => ({
    id: r.id as number,
    name_ar: r.name_ar as string,
    name_en: r.name_en as string,
  }));
}

function mapRow(row: Record<string, unknown>): Question {
  return {
    id: row.id as number,
    categoryId: row.category_id as number,
    categoryNameAr: row.category_name as string | undefined,
    questionAr: row.question_ar as string,
    optionA: row.option_a as string,
    optionB: row.option_b as string,
    optionC: row.option_c as string,
    optionD: row.option_d as string,
    correctAnswer: row.correct_answer as 'A' | 'B' | 'C' | 'D',
    difficulty: row.difficulty as number,
    source: row.source as string | null,
  };
}
