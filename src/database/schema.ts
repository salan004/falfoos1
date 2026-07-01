import { execute, executeBatch, queryOne } from './helpers';

function migrateUsersTable(): void {
  const existing = queryOne('PRAGMA table_info(users)');
  if (!existing) return;

  const columns: string[] = [];
  const stmt = queryOne('SELECT group_concat(name) as names FROM pragma_table_info(\'users\')');
  if (stmt) {
    const names = (stmt.names as string) || '';
    columns.push(...names.split(','));
  }

  const migrations: { col: string; def: string }[] = [
    { col: 'current_streak', def: 'INTEGER DEFAULT 0' },
    { col: 'best_streak', def: 'INTEGER DEFAULT 0' },
    { col: 'first_place', def: 'INTEGER DEFAULT 0' },
    { col: 'second_place', def: 'INTEGER DEFAULT 0' },
    { col: 'third_place', def: 'INTEGER DEFAULT 0' },
    { col: 'total_wins', def: 'INTEGER DEFAULT 0' },
  ];

  for (const m of migrations) {
    if (!columns.includes(m.col)) {
      try {
        execute(`ALTER TABLE users ADD COLUMN ${m.col} ${m.def}`);
      } catch {
        // column already exists
      }
    }
  }
}

function migrateQuizSessionsTable(): void {
  const stmt = queryOne('SELECT group_concat(name) as names FROM pragma_table_info(\'quiz_sessions\')');
  if (!stmt) return;
  const names = (stmt.names as string) || '';
  const columns = names.split(',');

  const migrations: { col: string; def: string }[] = [
    { col: 'position', def: 'INTEGER DEFAULT 0' },
  ];

  for (const m of migrations) {
    if (!columns.includes(m.col)) {
      try {
        execute(`ALTER TABLE quiz_sessions ADD COLUMN ${m.col} ${m.def}`);
      } catch {
        // column already exists
      }
    }
  }
}

export function initializeSchema(): void {
  executeBatch(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_ar TEXT NOT NULL UNIQUE,
      name_en TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      question_ar TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_answer TEXT NOT NULL CHECK(correct_answer IN ('A','B','C','D')),
      difficulty INTEGER DEFAULT 1 CHECK(difficulty BETWEEN 1 AND 5),
      source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      username TEXT DEFAULT '',
      points INTEGER DEFAULT 0,
      coins INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      correct_answers INTEGER DEFAULT 0,
      wrong_answers INTEGER DEFAULT 0,
      total_quizzes INTEGER DEFAULT 0,
      current_streak INTEGER DEFAULT 0,
      best_streak INTEGER DEFAULT 0,
      first_place INTEGER DEFAULT 0,
      second_place INTEGER DEFAULT 0,
      third_place INTEGER DEFAULT 0,
      total_wins INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, guild_id)
    );

    CREATE TABLE IF NOT EXISTS quiz_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      total_questions INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      points_earned INTEGER NOT NULL DEFAULT 0,
      coins_earned INTEGER NOT NULL DEFAULT 0,
      position INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','completed','cancelled')),
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS quiz_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      question_id INTEGER NOT NULL,
      selected_answer TEXT,
      is_correct BOOLEAN,
      status TEXT NOT NULL DEFAULT 'answered' CHECK(status IN ('answered','skipped')),
      answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES quiz_sessions(id)
    );

    CREATE TABLE IF NOT EXISTS quiz_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      correct_count INTEGER NOT NULL DEFAULT 0,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      total_time INTEGER NOT NULL DEFAULT 0,
      points_earned INTEGER NOT NULL DEFAULT 0,
      position INTEGER DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES quiz_sessions(id)
    );

    CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category_id);
    CREATE INDEX IF NOT EXISTS idx_users_guild ON users(guild_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_guild ON quiz_sessions(guild_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON quiz_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_answers_session ON quiz_answers(session_id);
    CREATE INDEX IF NOT EXISTS idx_participants_session ON quiz_participants(session_id);
    CREATE INDEX IF NOT EXISTS idx_participants_user ON quiz_participants(user_id);
  `);

  migrateUsersTable();
  migrateQuizSessionsTable();
}
