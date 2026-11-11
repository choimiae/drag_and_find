import { getAccessToken, type GoogleServiceAccountEnv } from './oauth';
import type { UsageMetrics } from './types';

interface Ga4Env extends GoogleServiceAccountEnv {
  GA4_PROPERTY_ID?: string;
}

interface ReportRow {
  dimensionValues?: Array<{ value: string }>;
  metricValues?: Array<{ value: string }>;
}

interface Report {
  rows?: ReportRow[];
}

export async function getUsageMetrics(
  env: Ga4Env,
  days: 1 | 7 | 30,
  fetchFn: typeof fetch = fetch,
): Promise<UsageMetrics> {
  if (!env.GA4_PROPERTY_ID || !/^\d+$/.test(env.GA4_PROPERTY_ID))
    throw new Error('GA4 속성 ID가 없습니다');
  const token = await getAccessToken(
    env,
    'https://www.googleapis.com/auth/analytics.readonly',
    fetchFn,
  );
  const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:runReport`;
  const base = {
    dateRanges: [{ startDate: days === 1 ? 'today' : `${days - 1}daysAgo`, endDate: 'today' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: { values: ['lookup_completed', 'lookup_failed'] },
      },
    },
  };
  const report = async (body: object): Promise<Report> => {
    const response = await fetchFn(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('GA4 통계 조회 실패');
    return (await response.json()) as Report;
  };
  const [users, events] = await Promise.all([
    report({ ...base, metrics: [{ name: 'totalUsers' }] }),
    report({
      ...base,
      dimensions: [{ name: 'date' }, { name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      limit: 100,
    }),
  ]);
  const daily = new Map<string, { date: string; completed: number; failed: number }>();
  let completed = 0;
  let failed = 0;
  for (const row of events.rows ?? []) {
    const rawDate = row.dimensionValues?.[0]?.value;
    const event = row.dimensionValues?.[1]?.value;
    const count = Number(row.metricValues?.[0]?.value ?? 0);
    if (!rawDate || !/^\d{8}$/.test(rawDate) || !Number.isFinite(count)) continue;
    const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    const item = daily.get(date) ?? { date, completed: 0, failed: 0 };
    if (event === 'lookup_completed') {
      item.completed += count;
      completed += count;
    }
    if (event === 'lookup_failed') {
      item.failed += count;
      failed += count;
    }
    daily.set(date, item);
  }
  return {
    activeInstalls: Number(users.rows?.[0]?.metricValues?.[0]?.value ?? 0),
    completed,
    failed,
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
