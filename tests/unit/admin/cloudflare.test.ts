import { describe, expect, it, vi } from 'vitest';
import { getWorkerMetrics } from '../../../admin/src/cloudflare';

describe('Cloudflare 통계', () => {
  it('대상 Worker의 요청 수와 오류 수를 읽는다', async () => {
    const fetchFn = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { variables: { scriptName: string } };
      expect(body.variables.scriptName).toBe('drag-and-find-lookup');
      return Response.json({
        data: {
          viewer: {
            accounts: [{ workersInvocationsAdaptive: [{ sum: { requests: 1318, errors: 3 } }] }],
          },
        },
      });
    });

    const metrics = await getWorkerMetrics('token', 'account', 'drag-and-find-lookup', 7, fetchFn);

    expect(metrics).toEqual({ requests: 1318, errors: 3 });
  });

  it('GraphQL 오류를 성공 수치로 취급하지 않는다', async () => {
    const fetchFn = vi.fn(async () => Response.json({ errors: [{ message: 'unauthorized' }] }));

    await expect(
      getWorkerMetrics('token', 'account', 'drag-and-find-lookup', 7, fetchFn),
    ).rejects.toThrow();
  });

  it('오늘은 UTC 자정부터, 최근 7일은 6일 전 자정부터 계산한다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T12:00:00.000Z'));
    try {
      const starts: string[] = [];
      const fetchFn = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { variables: { start: string } };
        starts.push(body.variables.start);
        return Response.json({
          data: { viewer: { accounts: [{ workersInvocationsAdaptive: [] }] } },
        });
      });
      await getWorkerMetrics('token', 'account', 'worker', 1, fetchFn);
      await getWorkerMetrics('token', 'account', 'worker', 7, fetchFn);
      expect(starts).toEqual(['2026-11-11T00:00:00.000Z', '2026-11-05T00:00:00.000Z']);
    } finally {
      vi.useRealTimers();
    }
  });
});
