import { describe, expect, it, vi } from 'vitest';
import { createAnalyticsClient } from '../../../lib/analytics/client';
import { memoryArea } from '../memory-area';

describe('확장 조회 통계', () => {
  it('설정에서 내 조회 포함을 끄면 이후 통계를 보내지 않고 다시 켜면 보낸다', async () => {
    const storage = memoryArea({ includeUsage: false });
    const fetchFn = vi.fn(async () => new Response(null, { status: 204 }));
    const analytics = createAnalyticsClient({
      workerUrl: 'https://lookup.example.test',
      version: '1.0.6',
      storage,
      fetchFn,
    });

    await analytics.recordLookupOutcome({ status: 'not_found' });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(await storage.get('analyticsClientId')).toEqual({});

    await storage.set({ includeUsage: true });
    await analytics.recordLookupOutcome({ status: 'not_found' });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    await storage.set({ includeUsage: false });
    await analytics.recordLookupOutcome({ status: 'not_found' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('설치별 ID를 재사용하고 결과 종류·버전만 전송한다', async () => {
    const values = new Map<string, string>();
    const storage = {
      get: vi.fn(async (key: string) => ({ [key]: values.get(key) })),
      set: vi.fn(async (entry: Record<string, string>) => {
        for (const [key, value] of Object.entries(entry)) values.set(key, value);
      }),
    };
    const requests: Array<Record<string, unknown>> = [];
    const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(null, { status: 204 });
    });
    const analytics = createAnalyticsClient({
      workerUrl: 'https://lookup.example.test',
      version: '1.0.4',
      storage,
      fetchFn,
    });

    await analytics.recordLookupOutcome({ status: 'not_found' });
    await analytics.recordLookupOutcome({ status: 'network_error' });

    expect(requests).toHaveLength(2);
    expect(requests[0]).toEqual({
      clientId: expect.any(String),
      event: 'lookup_completed',
      version: '1.0.4',
    });
    expect(requests[0]?.clientId).toMatch(/^[1-9]\d*\.[1-9]\d*$/);
    expect(requests[1]).toEqual({
      clientId: requests[0]?.clientId,
      event: 'lookup_failed',
      version: '1.0.4',
    });
  });

  it('이전 UUID 식별자는 GA4 형식으로 갱신한다', async () => {
    const values = new Map([['analyticsClientId', '2c316d5b-1234-4bc5-a976-09587a318250']]);
    let sentId = '';
    const client = createAnalyticsClient({
      workerUrl: 'https://lookup.example.test',
      version: '1.0.4',
      storage: {
        get: async (key) => ({ [key]: values.get(key) }),
        set: async (entry) => {
          for (const [key, value] of Object.entries(entry)) values.set(key, value);
        },
      },
      fetchFn: vi.fn(async (_input, init) => {
        sentId = (JSON.parse(String(init?.body)) as { clientId: string }).clientId;
        return new Response(null, { status: 204 });
      }),
    });

    await client.recordLookupOutcome({
      status: 'found',
      source: 'wikipedia',
      title: 'test',
      extract: 'test',
      url: 'https://example.test',
      isDisambiguation: false,
    });
    expect(sentId).toMatch(/^[1-9]\d*\.[1-9]\d*$/);
    expect(values.get('analyticsClientId')).toBe(sentId);
  });

  it('통계 전송 오류가 조회 결과 처리로 전파되지 않는다', async () => {
    const analytics = createAnalyticsClient({
      workerUrl: 'https://lookup.example.test',
      version: '1.0.4',
      storage: { get: async () => ({}), set: async () => {} },
      fetchFn: vi.fn(async () => {
        throw new Error('offline');
      }),
    });

    await expect(
      analytics.recordLookupOutcome({ status: 'rate_limited' }),
    ).resolves.toBeUndefined();
  });
});
