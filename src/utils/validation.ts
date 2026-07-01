import { CommunityMeme, PendingSubmission, MemeCategory } from '../types';

export function safeString(value: unknown, fallback: string = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return fallback; }
  }
  return fallback;
}

export function safeStringTrimmed(value: unknown, fallback: string = '', maxLength: number = 4096): string {
  const str = safeString(value, fallback);
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

export function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function safeId(value: unknown, fallback: string = 'unknown'): string {
  const str = safeString(value, fallback);
  return str.trim().length > 0 ? str : fallback;
}

const VALID_CATEGORIES: readonly string[] = ['arabic', 'gaming', 'discord', 'school', 'internet', 'random'];

function isValidCategory(value: unknown): value is MemeCategory {
  return typeof value === 'string' && VALID_CATEGORIES.includes(value);
}

function safeCategory(value: unknown, fallback: MemeCategory = 'random'): MemeCategory {
  return isValidCategory(value) ? value : fallback;
}

function isISODateString(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

export function validatePendingSubmission(value: unknown): PendingSubmission | null {
  if (value === null || value === undefined || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const id = safeId(obj.id);
  const authorId = safeId(obj.authorId);
  const imageUrl = safeUrl(obj.imageUrl);
  const title = safeString(obj.title, '');
  const category = safeCategory(obj.category);
  const submittedAt = isISODateString(obj.submittedAt) ? String(obj.submittedAt) : new Date().toISOString();
  if (!imageUrl) return null;
  return { id, authorId, imageUrl, title, category, submittedAt };
}

export function validateCommunityMeme(value: unknown): CommunityMeme | null {
  if (value === null || value === undefined || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const id = safeId(obj.id);
  const authorId = safeId(obj.authorId);
  const imageUrl = safeUrl(obj.imageUrl);
  const category = safeCategory(obj.category);
  const createdAt = isISODateString(obj.createdAt) ? String(obj.createdAt) : new Date().toISOString();
  if (!imageUrl) return null;
  return {
    id,
    authorId,
    imageUrl,
    title: safeString(obj.title, ''),
    category,
    funny: typeof obj.funny === 'number' && !isNaN(obj.funny) ? obj.funny : 0,
    legendary: typeof obj.legendary === 'number' && !isNaN(obj.legendary) ? obj.legendary : 0,
    likes: typeof obj.likes === 'number' && !isNaN(obj.likes) ? obj.likes : 0,
    score: typeof obj.score === 'number' && !isNaN(obj.score) ? obj.score : 0,
    approved: obj.approved === true,
    voting: obj.voting === true,
    winner: obj.winner === true,
    placement: obj.placement === null || obj.placement === undefined ? null : (typeof obj.placement === 'number' ? obj.placement : null),
    createdAt,
    expiresAt: isISODateString(obj.expiresAt) ? String(obj.expiresAt) : null,
  };
}

export function validateCachedMeme(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const imageUrl = safeUrl(obj.imageUrl);
  if (!imageUrl) return null;
  return {
    ...obj,
    imageUrl,
    title: safeString(obj.title, ''),
    category: safeCategory(obj.category),
    source: safeString(obj.source, 'unknown'),
    sourceType: safeString(obj.sourceType, 'international'),
    nsfw: obj.nsfw === true,
    cachedAt: isISODateString(obj.cachedAt) ? String(obj.cachedAt) : new Date().toISOString(),
  };
}

export interface RepairResult<T> {
  clean: T[];
  warnings: string[];
}

export function repairArray<T>(
  items: unknown[],
  validator: (item: unknown) => T | null,
  label: string
): RepairResult<T> {
  const warnings: string[] = [];
  const clean: T[] = [];
  let skipped = 0;
  let repaired = 0;

  for (let i = 0; i < items.length; i++) {
    const result = validator(items[i]);
    if (result === null) {
      skipped++;
      warnings.push(`${label}[${i}]: skipped — invalid entry`);
    } else if (JSON.stringify(result) !== JSON.stringify(items[i])) {
      repaired++;
      warnings.push(`${label}[${i}]: repaired — ${describeDiff(items[i] as Record<string, unknown>, result as unknown as Record<string, unknown>)}`);
      clean.push(result);
    } else {
      clean.push(result);
    }
  }

  if (repaired > 0 || skipped > 0) {
    warnings.unshift(`${label}: repaired ${repaired}, skipped ${skipped} of ${items.length} entries`);
  }

  return { clean, warnings };
}

function describeDiff(original: Record<string, unknown>, cleaned: Record<string, unknown>): string {
  const diffs: string[] = [];
  for (const key of Object.keys(cleaned)) {
    const a = original[key];
    const b = cleaned[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      diffs.push(`${key}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
    }
  }
  return diffs.join(', ') || 'fields corrected';
}

export function validateNumber(value: unknown, fallback: number = 0): number {
  return typeof value === 'number' && !isNaN(value) ? value : fallback;
}
