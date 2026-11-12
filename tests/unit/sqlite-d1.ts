import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import type { UsageDatabase, UsageStatement } from '../../worker/usage-db';

export function sqliteUsageDb(): { db: UsageDatabase; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(
    readFileSync(new URL('../../worker/migrations/0001_usage.sql', import.meta.url), 'utf8'),
  );

  const statement = (sql: string, values: Array<string | number> = []): UsageStatement => ({
    bind(...next) {
      return statement(sql, next);
    },
    async run() {
      sqlite.prepare(sql).run(...values);
    },
    async all<T>() {
      return { results: sqlite.prepare(sql).all(...values) as T[] };
    },
  });

  return {
    sqlite,
    db: {
      prepare: statement,
      async batch(statements) {
        sqlite.exec('BEGIN');
        try {
          for (const entry of statements) await entry.run();
          sqlite.exec('COMMIT');
        } catch (error) {
          sqlite.exec('ROLLBACK');
          throw error;
        }
      },
    },
  };
}
