import { getDb, saveDb } from './connection';

export function queryOne(sql: string, params?: unknown[]): Record<string, unknown> | undefined {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  if (stmt.step()) {
    const result = stmt.getAsObject() as Record<string, unknown>;
    stmt.free();
    return result;
  }
  stmt.free();
  return undefined;
}

export function queryAll(sql: string, params?: unknown[]): Record<string, unknown>[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const results: Record<string, unknown>[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as Record<string, unknown>);
  }
  stmt.free();
  return results;
}

export function execute(sql: string, params?: unknown[]): number {
  const db = getDb();
  db.run(sql, params);
  const changes = db.getRowsModified();
  saveDb();
  return changes;
}

export function executeInsert(sql: string, params?: unknown[]): number {
  const db = getDb();
  db.run(sql, params);
  const lastId = (db.exec('SELECT last_insert_rowid() as id')[0]?.values[0]?.[0] as number) ?? 0;
  saveDb();
  return lastId;
}

export function executeBatch(sql: string): void {
  const db = getDb();
  db.run(sql);
  saveDb();
}

let transactionDepth = 0;

export function beginTransaction(): void {
  const db = getDb();
  if (transactionDepth === 0) {
    db.run('BEGIN TRANSACTION');
  } else {
    db.run(`SAVEPOINT sp_${transactionDepth}`);
  }
  transactionDepth++;
}

export function commitTransaction(): void {
  const db = getDb();
  if (transactionDepth <= 0) {
    throw new Error('No active transaction to commit');
  }
  transactionDepth--;
  if (transactionDepth === 0) {
    db.run('COMMIT');
    saveDb();
  } else {
    db.run(`RELEASE sp_${transactionDepth}`);
  }
}

export function rollbackTransaction(): void {
  const db = getDb();
  if (transactionDepth <= 0) return;
  transactionDepth--;
  if (transactionDepth === 0) {
    db.run('ROLLBACK');
  } else {
    db.run(`ROLLBACK TO sp_${transactionDepth}`);
  }
}

export function execInTransaction(sql: string, params?: unknown[]): void {
  getDb().run(sql, params);
}
