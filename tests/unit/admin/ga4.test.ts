import { describe, expect, it, vi } from 'vitest';
import { getUsageMetrics } from '../../../admin/src/ga4';
import { serviceAccountJson } from './service-account-fixture';

describe('GA4 사용 통계', () => {
  it('조회 이벤트만으로 설치 수와 일별 건수를 계산한다', async () => {
    const account = await serviceAccountJson();
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('oauth2.googleapis.com'))
        return Response.json({ access_token: 'token' });
      expect(String(input)).toContain('/properties/1234:runReport');
      const body = JSON.parse(String(init?.body)) as { dimensions?: Array<{ name: string }> };
      if (!body.dimensions) return Response.json({ rows: [{ metricValues: [{ value: '3' }] }] });
      return Response.json({
        rows: [
          {
            dimensionValues: [{ value: '20261109' }, { value: 'lookup_completed' }],
            metricValues: [{ value: '5' }],
          },
          {
            dimensionValues: [{ value: '20261109' }, { value: 'lookup_failed' }],
            metricValues: [{ value: '2' }],
          },
        ],
      });
    });

    const result = await getUsageMetrics(
      { GOOGLE_SERVICE_ACCOUNT_JSON: account, GA4_PROPERTY_ID: '1234' },
      7,
      fetchFn,
    );

    expect(result.activeInstalls).toBe(3);
    expect(result.completed).toBe(5);
    expect(result.failed).toBe(2);
    expect(result.daily).toEqual([{ date: '2026-11-09', completed: 5, failed: 2 }]);
  });
});
