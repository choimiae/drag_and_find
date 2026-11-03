import { parseDisambiguationHtml, type ParsedLink } from './disambiguation';
import type { DisambiguationInfo, LookupProvider, LookupResult } from './types';

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

const EXCLUDED_CANDIDATE_TITLES = new Set(['위키낱말사전']);

interface ExtractsResponse {
  query?: { pages?: Record<string, { title?: string; extract?: string }> };
}

interface ParseResponse {
  parse?: { text?: unknown; links?: unknown };
}

function isParsedLink(value: unknown): value is ParsedLink {
  if (typeof value !== 'object' || value === null) return false;
  const { ns, title, exists } = value as Record<string, unknown>;
  return typeof ns === 'number' && typeof title === 'string' && typeof exists === 'boolean';
}

class RateLimitedError extends Error {}
class ServerError extends Error {}

interface WikipediaOptions {
  userAgent: string;
  fetchFn?: FetchFn;
}

export interface DirectMissLookupProvider extends LookupProvider {
  lookupWithDirectMiss(query: string, onDirectMiss: () => void): Promise<LookupResult>;
}

/** 한국어 위키백과에서 검색어의 요약을 찾는 출처를 만든다. */
export function createWikipediaKoProvider({
  userAgent,
  fetchFn = (input, init) => fetch(input, init),
}: WikipediaOptions): DirectMissLookupProvider {
  async function requestJson<T>(url: string): Promise<T | null> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        const response = await fetchFn(url, {
          headers: {
            'User-Agent': userAgent,
            'Api-User-Agent': userAgent,
          },
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
      source: 'wikipedia',
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

  async function fetchPages(params: Record<string, string>) {
    const query = new URLSearchParams({ action: 'query', format: 'json', ...params });
    const data = await requestJson<ExtractsResponse>(`${ORIGIN}/w/api.php?${query}`);
    return data?.query?.pages ? Object.values(data.query.pages) : null;
  }

  async function fetchDisambiguation(title: string): Promise<DisambiguationInfo | null> {
    try {
      const parseParams = new URLSearchParams({
        action: 'parse',
        page: title,
        prop: 'text|links',
        formatversion: '2',
        disabletoc: '1',
        disableeditsection: '1',
        disablelimitreport: '1',
        format: 'json',
      });
      const [parsed, linkedPages] = await Promise.all([
        requestJson<ParseResponse>(`${ORIGIN}/w/api.php?${parseParams}`),
        fetchPages({
          generator: 'links',
          titles: title,
          gplnamespace: '0',
          gpllimit: '50',
          prop: 'extracts',
          exintro: '1',
          explaintext: '1',
          exlimit: '20',
          exchars: '300',
        }).catch(() => null),
      ]);
      const text = parsed?.parse?.text;
      const links = parsed?.parse?.links;
      if (typeof text !== 'string' || !Array.isArray(links)) return null;
      const isLinkable = <P extends { title?: string }>(page: P): page is P & { title: string } =>
        typeof page.title === 'string' &&
        page.title !== title &&
        !EXCLUDED_CANDIDATE_TITLES.has(page.title);
      const candidates = (linkedPages ?? []).flatMap((page) =>
        isLinkable(page) && typeof page.extract === 'string' && page.extract !== ''
          ? [{ title: page.title, extract: page.extract, url: wikiUrl(page.title) }]
          : [],
      );
      const { basic, meanings } = parseDisambiguationHtml(text, links.filter(isParsedLink));
      const extracts = new Map(candidates.map((candidate) => [candidate.title, candidate.extract]));
      return {
        basic,
        meanings: meanings.map((meaning) => {
          if (meaning.description || !meaning.title) return meaning;
          const extract = extracts.get(meaning.title);
          return extract ? { ...meaning, description: shortExplanation(extract) } : meaning;
        }),
        candidates,
      };
    } catch {
      // 뜻 구분 본문도 읽지 못한 경우에는 기존 안내만 보여 준다.
      return null;
    }
  }

  async function findArticle(query: string, onDirectMiss: () => void): Promise<LookupResult> {
    const direct = await fetchSummary(query);
    if (direct) return direct;
    onDirectMiss();

    const candidate = await searchTopTitle(query);

    if (!candidate || !isRelevantTitle(query, candidate)) {
      return { status: 'not_found' };
    }

    return (await fetchSummary(candidate)) ?? { status: 'not_found' };
  }

  async function lookupWithDirectMiss(
    query: string,
    onDirectMiss: () => void,
  ): Promise<LookupResult> {
    try {
      const found = await findArticle(query, onDirectMiss);
      if (found.status !== 'found' || !found.isDisambiguation) return found;
      const disambiguation = await fetchDisambiguation(found.title);
      return disambiguation ? { ...found, disambiguation } : found;
    } catch (error) {
      if (error instanceof RateLimitedError) return { status: 'rate_limited' };
      return { status: 'network_error' };
    }
  }

  return {
    lookup: (query) => lookupWithDirectMiss(query, () => {}),
    lookupWithDirectMiss,
  };
}

function shortExplanation(extract: string): string {
  const first =
    extract
      .trim()
      .match(/^[^.!?\n]*[.!?]?/u)?.[0]
      ?.trim() ?? '';
  const chars = Array.from(first || extract.trim());
  return chars.length > 140 ? `${chars.slice(0, 140).join('')}…` : chars.join('');
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
  return wikiUrl(title);
}

function wikiUrl(title: string): string {
  return `${ORIGIN}/wiki/${encodeURIComponent(title)}`;
}
