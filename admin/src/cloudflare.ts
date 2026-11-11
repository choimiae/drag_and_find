import type { WorkerMetrics } from './types';

const QUERY = `query WorkerMetrics($accountTag: string, $scriptName: string, $start: string, $end: string) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workersInvocationsAdaptive(limit: 1, filter: { scriptName: $scriptName, datetime_geq: $start, datetime_leq: $end }) {
        sum { requests errors }
      }
    }
  }
}`;

export async function getWorkerMetrics(
  token: string,
  accountId: string,
  scriptName: string,
  days: 1 | 7 | 30,
  fetchFn: typeof fetch = fetch,
): Promise<WorkerMetrics> {
  const end = new Date();
  const start = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - days + 1),
  );
  const response = await fetchFn('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        accountTag: accountId,
        scriptName,
        start: start.toISOString(),
        end: end.toISOString(),
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Cloudflare 통계 요청 실패');
  const body: unknown = await response.json();
  if (
    typeof body !== 'object' ||
    body === null ||
    ('errors' in body && Array.isArray(body.errors) && body.errors.length > 0)
  )
    throw new Error('Cloudflare 통계 오류');
  const accounts = (
    body as {
      data?: {
        viewer?: {
          accounts?: Array<{
            workersInvocationsAdaptive?: Array<{ sum?: { requests?: unknown; errors?: unknown } }>;
          }>;
        };
      };
    }
  ).data?.viewer?.accounts;
  if (!Array.isArray(accounts) || accounts.length !== 1)
    throw new Error('Cloudflare 계정을 확인할 수 없습니다');
  const rows = accounts[0]?.workersInvocationsAdaptive;
  if (!Array.isArray(rows)) throw new Error('Worker 통계 형식이 잘못되었습니다');
  if (rows.length === 0) return { requests: 0, errors: 0 };
  const requests = rows[0]?.sum?.requests;
  const errors = rows[0]?.sum?.errors;
  if (
    typeof requests !== 'number' ||
    typeof errors !== 'number' ||
    !Number.isFinite(requests) ||
    !Number.isFinite(errors)
  )
    throw new Error('Worker 통계 값이 잘못되었습니다');
  return { requests, errors };
}
