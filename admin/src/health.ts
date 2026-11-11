import type { HealthMetrics } from './types';

export async function checkLookupHealth(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
): Promise<HealthMetrics> {
  const url = new URL('/lookup', baseUrl);
  url.searchParams.set('query', '온보딩');
  const start = performance.now();
  const response = await fetchFn(url.href, { signal: AbortSignal.timeout(20_000) });
  const latencyMs = Math.round(performance.now() - start);
  if (response.status !== 200) throw new Error(`조회 Worker HTTP ${response.status}`);
  const body: unknown = await response.json();
  if (
    typeof body !== 'object' ||
    body === null ||
    !('status' in body) ||
    body.status !== 'found' ||
    !('source' in body) ||
    !['naver', 'wikipedia', 'wikidata'].includes(String(body.source)) ||
    !('title' in body) ||
    typeof body.title !== 'string' ||
    body.title.trim() === '' ||
    !('extract' in body) ||
    typeof body.extract !== 'string' ||
    body.extract.trim() === '' ||
    !('url' in body) ||
    typeof body.url !== 'string' ||
    !URL.canParse(body.url) ||
    !('isDisambiguation' in body) ||
    typeof body.isDisambiguation !== 'boolean'
  )
    throw new Error('조회 Worker 응답 형식 오류');
  return { httpStatus: response.status, latencyMs };
}
