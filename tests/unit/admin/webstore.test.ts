import { describe, expect, it, vi } from 'vitest';
import { getWebStoreMetrics } from '../../../admin/src/webstore';
import { serviceAccountJson } from './service-account-fixture';

const env = async () => ({
  GOOGLE_SERVICE_ACCOUNT_JSON: await serviceAccountJson(),
  CWS_PUBLISHER_ID: 'publisher',
  CWS_ITEM_ID: 'extension',
});

describe('Chrome Web Store 통계', () => {
  it('기간 내 설치·삭제·노출·페이지 조회를 합산하고 마지막 일일 이용자를 표시한다', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('oauth2.googleapis.com')) return Response.json({ access_token: 'token' });
      expect(url).toContain('/v2/publishers/publisher/items/extension:queryMetrics');
      expect(url).toContain('metrics=installs');
      return Response.json({
        metricRows: [
          {
            date: { year: 2026, month: 11, day: 9 },
            metricValues: [
              { metric: 'installs', value: '2' },
              { metric: 'uninstalls', value: '1' },
              { metric: 'users', value: '40' },
              { metric: 'impressions', value: '100' },
              { metric: 'page-views', value: '60' },
            ],
          },
          {
            date: { year: 2026, month: 11, day: 10 },
            metricValues: [
              { metric: 'installs', value: '3' },
              { metric: 'uninstalls', value: '0' },
              { metric: 'users', value: '44' },
              { metric: 'impressions', value: '120' },
              { metric: 'page-views', value: '70' },
            ],
          },
        ],
      });
    });

    const metrics = await getWebStoreMetrics(
      await env(),
      7,
      fetchFn,
      new Date('2026-11-10T14:00:00.000Z'),
    );

    expect(metrics).toEqual({
      installs: 5,
      uninstalls: 1,
      users: 44,
      impressions: 220,
      pageViews: 130,
    });
  });

  it('응답 값이 잘못되면 성공으로 표시하지 않는다', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('oauth2.googleapis.com')
        ? Response.json({ access_token: 'token' })
        : Response.json({
            metricRows: [
              {
                date: { year: 2026, month: 11, day: 10 },
                metricValues: [{ metric: 'installs', value: 'oops' }],
              },
            ],
          }),
    );

    await expect(
      getWebStoreMetrics(await env(), 7, fetchFn, new Date('2026-11-10T14:00:00.000Z')),
    ).rejects.toThrow();
  });
});
