import type { UsageMetrics } from '../admin/src/types';

export interface UsageStatement {
  bind(...values: Array<string | number>): UsageStatement;
  run(): Promise<unknown>;
  all<T>(): Promise<{ results: T[] }>;
}

export interface UsageDatabase {
  prepare(sql: string): UsageStatement;
  batch(statements: UsageStatement[]): Promise<unknown>;
}

const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function seoulDay(now: Date, daysAgo = 0): string {
  return new Date(now.getTime() + SEOUL_OFFSET_MS - daysAgo * DAY_MS).toISOString().slice(0, 10);
}

async function hashClientId(clientId: string): Promise<string> {
  const bytes = new TextEncoder().encode(clientId);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function recordUsage(
  db: UsageDatabase,
  clientId: string,
  event: 'lookup_completed' | 'lookup_failed',
  now: Date = new Date(),
): Promise<void> {
  const day = seoulDay(now);
  const clientHash = await hashClientId(clientId);
  await db.batch([
    db
      .prepare(
        'INSERT INTO usage_daily (day, completed, failed) VALUES (?, ?, ?) ON CONFLICT(day) DO UPDATE SET completed = completed + excluded.completed, failed = failed + excluded.failed',
      )
      .bind(day, event === 'lookup_completed' ? 1 : 0, event === 'lookup_failed' ? 1 : 0),
    db
      .prepare('INSERT OR IGNORE INTO usage_clients (day, client_hash) VALUES (?, ?)')
      .bind(day, clientHash),
  ]);
}

export async function getLiveUsage(
  db: UsageDatabase,
  days: 1 | 7 | 30,
  now: Date = new Date(),
): Promise<UsageMetrics> {
  const start = seoulDay(now, days - 1);
  const end = seoulDay(now);
  const [dailyResult, clientsResult] = await Promise.all([
    db
      .prepare(
        'SELECT day AS date, completed, failed FROM usage_daily WHERE day >= ? AND day <= ? ORDER BY day',
      )
      .bind(start, end)
      .all<{ date: string; completed: number; failed: number }>(),
    db
      .prepare(
        'SELECT COUNT(DISTINCT client_hash) AS count FROM usage_clients WHERE day >= ? AND day <= ?',
      )
      .bind(start, end)
      .all<{ count: number }>(),
  ]);
  const daily = dailyResult.results;
  return {
    activeInstalls: clientsResult.results[0]?.count ?? 0,
    completed: daily.reduce((sum, row) => sum + row.completed, 0),
    failed: daily.reduce((sum, row) => sum + row.failed, 0),
    daily,
  };
}

export async function cleanupUsage(db: UsageDatabase, now: Date = new Date()): Promise<void> {
  const cutoff = seoulDay(now, 29);
  await db.batch([
    db.prepare('DELETE FROM usage_daily WHERE day < ?').bind(cutoff),
    db.prepare('DELETE FROM usage_clients WHERE day < ?').bind(cutoff),
  ]);
}
