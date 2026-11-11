import { describe, expect, it, vi } from 'vitest';
import { checkLookupHealth } from '../../../admin/src/health';

describe('조회 Worker 상태', () => {
  it('실제 조회의 HTTP 상태와 응답 시간을 반환한다', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain('/lookup?query=');
      return Response.json({
        status: 'found',
        source: 'naver',
        title: '온보딩',
        extract: '설명',
        url: 'https://example.com',
        isDisambiguation: false,
      });
    });

    const health = await checkLookupHealth('https://lookup.example.test', fetchFn);

    expect(health.httpStatus).toBe(200);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      'https://lookup.example.test/lookup?query=%EC%98%A8%EB%B3%B4%EB%94%A9',
    );
  });

  it('형식이 잘못된 응답을 정상으로 표시하지 않는다', async () => {
    const fetchFn = vi.fn(async () => Response.json({ status: 'found' }));

    await expect(checkLookupHealth('https://lookup.example.test', fetchFn)).rejects.toThrow();
  });
});
