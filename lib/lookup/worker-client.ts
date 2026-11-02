import { isLookupResult } from '../messages';
import type { FetchFn } from './wikipedia';
import type { LookupProvider, LookupResult } from './types';

// 네이버 5초와 위키백과 최대 2회×5초 뒤 응답 전송 시간을 확보한다.
const TIMEOUT_MS = 18000;

/** 확장 백그라운드에서 Worker의 단일 조회 API를 호출한다. */
export function createWorkerProvider(baseUrl: string, fetchFn: FetchFn = fetch): LookupProvider {
  return {
    async lookup(query): Promise<LookupResult> {
      if (!baseUrl) return { status: 'network_error' };
      try {
        const url = new URL('/lookup', baseUrl);
        url.searchParams.set('query', query);
        const response = await fetchFn(url.href, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (response.status === 429) return { status: 'rate_limited' };
        if (!response.ok) return { status: 'network_error' };
        const result: unknown = await response.json();
        if (!isLookupResult(result)) return { status: 'network_error' };
        if (result.status === 'found' && !result.source) return { status: 'network_error' };
        return result;
      } catch {
        return { status: 'network_error' };
      }
    },
  };
}

/** 문맥 없이 후보 문서 제목만 Worker에 보내 영어 설명을 받는다. */
export function createEnglishContextClient(
  baseUrl: string,
  fetchFn: FetchFn = fetch,
): (titles: string[]) => Promise<Record<string, string>> {
  return async (titles) => {
    if (!baseUrl || titles.length === 0) return {};
    try {
      const url = new URL('/english-context', baseUrl);
      const response = await fetchFn(url.href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titles }),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) return {};
      const data: unknown = await response.json();
      if (typeof data !== 'object' || data === null || !('extracts' in data)) return {};
      const extracts = data.extracts;
      if (typeof extracts !== 'object' || extracts === null || Array.isArray(extracts)) return {};
      const entries = Object.entries(extracts);
      if (
        !entries.every(([title, extract]) => titles.includes(title) && typeof extract === 'string')
      ) {
        return {};
      }
      return Object.fromEntries(entries) as Record<string, string>;
    } catch {
      return {};
    }
  };
}
