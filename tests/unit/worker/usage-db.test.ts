// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { cleanupUsage, getLiveUsage, recordUsage } from '../../../worker/usage-db';
import { sqliteUsageDb } from '../sqlite-d1';

const DAY = new Date('2026-11-12T12:00:00Z');

describe('실시간 조회 사용량', () => {
  it('같은 설치의 여러 조회를 세되 사용 설치 수는 한 번만 센다', async () => {
    const { db, sqlite } = sqliteUsageDb();
    await recordUsage(db, '123.456', 'lookup_completed', DAY);
    await recordUsage(db, '123.456', 'lookup_completed', DAY);
    await recordUsage(db, '789.456', 'lookup_failed', DAY);

    expect(await getLiveUsage(db, 1, DAY)).toEqual({
      activeInstalls: 2,
      completed: 2,
      failed: 1,
      daily: [{ date: '2026-11-12', completed: 2, failed: 1 }],
    });
    expect(JSON.stringify(sqlite.prepare('SELECT * FROM usage_clients').all())).not.toContain(
      '123.456',
    );
  });

  it('한국 시간 날짜 경계와 1·7·30일 기간을 적용한다', async () => {
    const { db } = sqliteUsageDb();
    await recordUsage(db, '123.456', 'lookup_completed', new Date('2026-11-11T14:59:59Z'));
    await recordUsage(db, '123.456', 'lookup_failed', new Date('2026-11-11T15:00:00Z'));
    await recordUsage(db, '789.456', 'lookup_completed', new Date('2026-11-06T15:00:00Z'));
    await recordUsage(db, '999.456', 'lookup_completed', new Date('2026-10-14T15:00:00Z'));

    expect(await getLiveUsage(db, 1, DAY)).toMatchObject({
      activeInstalls: 1,
      completed: 0,
      failed: 1,
    });
    expect(await getLiveUsage(db, 7, DAY)).toMatchObject({
      activeInstalls: 2,
      completed: 2,
      failed: 1,
    });
    expect(await getLiveUsage(db, 30, DAY)).toMatchObject({
      activeInstalls: 3,
      completed: 3,
      failed: 1,
    });
  });

  it('30일보다 오래된 일별 기록을 삭제한다', async () => {
    const { db } = sqliteUsageDb();
    await recordUsage(db, '123.456', 'lookup_completed', new Date('2026-10-13T14:59:59Z'));
    await recordUsage(db, '789.456', 'lookup_completed', new Date('2026-10-13T15:00:00Z'));

    await cleanupUsage(db, DAY);

    expect(await getLiveUsage(db, 30, DAY)).toMatchObject({ activeInstalls: 1, completed: 1 });
  });
});
