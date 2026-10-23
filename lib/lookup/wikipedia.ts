import type { LookupProvider, LookupResult } from './types';

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

const ORIGIN = 'https://ko.wikipedia.org';
export const REQUEST_TIMEOUT_MS = 5000;
/** 최초 요청 1회 + 연결 오류·5xx일 때 자동 재시도 1회. */
const MAX_ATTEMPTS = 2;
const MIN_PREFIX_TITLE_LENGTH = 2;

interface SummaryResponse {
  type?: string;
  title?: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
}

interface SearchResponse {
  query?: { search?: Array<{ title?: string }> };
}

class RateLimitedError extends Error {}
class ServerError extends Error {}

interface WikipediaOptions {
  userAgent: string;
  fetchFn?: FetchFn;
}

/** 한국어 위키백과에서 검색어의 요약을 찾는 출처를 만든다. */
export function createWikipediaKoProvider({
  userAgent,
  fetchFn = (input, init) => fetch(input, init),
}: WikipediaOptions): LookupProvider {
  async function requestJson<T>(url: string): Promise<T | null> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        const response = await fetchFn(url, {
          headers: { 'Api-User-Agent': userAgent },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (response.status === 429) throw new RateLimitedError();
        if (response.status >= 500) throw new ServerError(`HTTP ${response.status}`);
        if (!response.ok) return null;
        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof RateLimitedError || attempt >= MAX_ATTEMPTS) throw error;
      }
    }
  }

  async function fetchSummary(title: string): Promise<LookupResult | null> {
    const data = await requestJson<SummaryResponse>(
      `${ORIGIN}/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    );
    if (!data?.title) return null;
    return {
      status: 'found',
      title: data.title,
      extract: data.extract ?? '',
      url: articleUrl(data.content_urls?.desktop?.page, data.title),
      isDisambiguation: data.type === 'disambiguation',
    };
  }

  async function searchTopTitle(query: string): Promise<string | null> {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: '1',
      format: 'json',
    });
    const data = await requestJson<SearchResponse>(`${ORIGIN}/w/api.php?${params}`);
    return data?.query?.search?.[0]?.title ?? null;
  }

  return {
    async lookup(query) {
      try {
        const direct = await fetchSummary(query);
        if (direct) return direct;
        const candidate = await searchTopTitle(query);
        if (!candidate || !isRelevantTitle(query, candidate)) return { status: 'not_found' };
        return (await fetchSummary(candidate)) ?? { status: 'not_found' };
      } catch (error) {
        if (error instanceof RateLimitedError) return { status: 'rate_limited' };
        return { status: 'network_error' };
      }
    },
  };
}

/** 검색 결과 제목이 검색어와 관련 있는지 판정한다(엉뚱한 결과 거르기). */
export function isRelevantTitle(query: string, title: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  const normalizedTitle = normalizeForMatch(title);
  if (normalizedTitle.includes(normalizedQuery)) return true;
  return (
    Array.from(normalizedTitle).length >= MIN_PREFIX_TITLE_LENGTH &&
    normalizedQuery.startsWith(normalizedTitle)
  );
}

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/[\s_]+/gu, '');
}

function articleUrl(candidate: string | undefined, title: string): string {
  if (candidate?.startsWith(`${ORIGIN}/`)) return candidate;
  return `${ORIGIN}/wiki/${encodeURIComponent(title)}`;
}
