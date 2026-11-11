import { getAccessToken, type GoogleServiceAccountEnv } from './oauth';
import type { StoreMetrics } from './types';

export interface WebStoreEnv extends GoogleServiceAccountEnv {
  CWS_PUBLISHER_ID?: string;
  CWS_ITEM_ID?: string;
}

type MetricRow = {
  date?: { year?: number; month?: number; day?: number };
  metricValues?: Array<{ metric?: string; value?: string }>;
};

function dateParts(date: Date): { year: number; month: number; day: number } {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function numberValue(value: unknown): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value))
    throw new Error('스토어 통계 값 형식 오류');
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('스토어 통계 값 범위 오류');
  return number;
}

export async function getWebStoreMetrics(
  env: WebStoreEnv,
  days: 1 | 7 | 30,
  fetchFn: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<StoreMetrics> {
  if (!env.CWS_PUBLISHER_ID || !env.CWS_ITEM_ID) throw new Error('스토어 항목 정보가 없습니다');
  const token = await getAccessToken(
    env,
    'https://www.googleapis.com/auth/chromewebstore.readonly',
    fetchFn,
  );
  const first = new Date(now);
  first.setUTCDate(first.getUTCDate() - days + 1);
  const from = dateParts(first);
  const to = dateParts(now);
  const url = new URL(
    `https://chromewebstore.googleapis.com/v2/publishers/${encodeURIComponent(env.CWS_PUBLISHER_ID)}/items/${encodeURIComponent(env.CWS_ITEM_ID)}:queryMetrics`,
  );
  for (const metric of ['installs', 'uninstalls', 'users', 'impressions', 'page-views'])
    url.searchParams.append('metrics', metric);
  for (const [prefix, value] of [
    ['firstDate', from],
    ['lastDate', to],
  ] as const) {
    for (const [key, part] of Object.entries(value))
      url.searchParams.set(`timeSpec.${prefix}.${key}`, String(part));
  }
  url.searchParams.set('pageSize', '1000');
  const rows: MetricRow[] = [];
  let pageToken: string | undefined;
  do {
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetchFn(url.href, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('스토어 통계 요청 실패');
    const result: unknown = await response.json();
    if (
      typeof result !== 'object' ||
      result === null ||
      !('metricRows' in result) ||
      !Array.isArray(result.metricRows)
    )
      throw new Error('스토어 통계 응답 형식 오류');
    rows.push(...(result.metricRows as MetricRow[]));
    pageToken =
      'nextPageToken' in result && typeof result.nextPageToken === 'string' && result.nextPageToken
        ? result.nextPageToken
        : undefined;
  } while (pageToken);

  const totals: StoreMetrics = {
    installs: 0,
    uninstalls: 0,
    users: 0,
    impressions: 0,
    pageViews: 0,
  };
  let lastUserDate = '';
  for (const row of rows) {
    if (!Array.isArray(row.metricValues)) throw new Error('스토어 통계 행 형식 오류');
    const date = row.date
      ? `${row.date.year}-${String(row.date.month).padStart(2, '0')}-${String(row.date.day).padStart(2, '0')}`
      : '';
    for (const metric of row.metricValues) {
      const value = numberValue(metric.value);
      switch (metric.metric) {
        case 'installs':
          totals.installs += value;
          break;
        case 'uninstalls':
          totals.uninstalls += value;
          break;
        case 'impressions':
          totals.impressions += value;
          break;
        case 'page-views':
          totals.pageViews += value;
          break;
        case 'users':
          if (date >= lastUserDate) {
            totals.users = value;
            lastUserDate = date;
          }
          break;
      }
    }
  }
  return totals;
}
