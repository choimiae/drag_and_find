import type { LookupProvider } from './types';
import type { DirectMissLookupProvider, FetchFn } from './wikipedia';

const EN_API = 'https://en.wikipedia.org/w/api.php';
const TIMEOUT_MS = 5000;

interface LangLinksResponse {
  query?: {
    pages?: Array<{
      ns?: number;
      missing?: boolean;
      langlinks?: Array<{
        lang?: string;
        title?: string;
        '*'?: string;
      }>;
    }>;
  };
}

interface Options {
  userAgent: string;
  fetchFn?: FetchFn;
}

/**
 * 한국어 위키백과에서 찾지 못한 영어 검색어를
 * 영어 위키백과의 한국어 연결 문서로 재조회한다.
 */
export function withEnglishWikipediaFallback(
  korean: LookupProvider & Partial<DirectMissLookupProvider>,
  { userAgent, fetchFn = fetch }: Options,
): LookupProvider {
  return {
    async lookup(query) {
      const needsEnglish = /[a-z]/i.test(query) && !/[가-힣]/u.test(query);
      const abortEnglish = new AbortController();
      let koreanTitlePromise: Promise<string | undefined> | undefined;
      const startEnglish = () => {
        if (needsEnglish && !koreanTitlePromise) {
          koreanTitlePromise = fetchKoreanTitle(query, userAgent, fetchFn, abortEnglish.signal);
        }
      };
      let original;
      try {
        original = await (korean.lookupWithDirectMiss
          ? korean.lookupWithDirectMiss(query, startEnglish)
          : korean.lookup(query));
      } catch (error) {
        abortEnglish.abort();
        throw error;
      }

      // 기존 한국어 위키백과 결과를 우선한다.
      if (original.status === 'found' || !needsEnglish) {
        abortEnglish.abort();
        return original;
      }

      startEnglish();
      const koreanTitle = await koreanTitlePromise;

      if (!koreanTitle || koreanTitle === query) {
        return original;
      }

      try {
        const translated = await korean.lookup(koreanTitle);

        return translated.status === 'found' ? translated : original;
      } catch {
        return original;
      }
    },
  };
}

async function fetchKoreanTitle(
  query: string,
  userAgent: string,
  fetchFn: FetchFn,
  abortSignal: AbortSignal,
): Promise<string | undefined> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      prop: 'langlinks',
      titles: query,
      redirects: '1',
      lllang: 'ko',
      lllimit: '1',
      format: 'json',
      formatversion: '2',
    });

    const response = await fetchFn(`${EN_API}?${params}`, {
      headers: {
        'User-Agent': userAgent,
        'Api-User-Agent': userAgent,
      },
      signal: AbortSignal.any([abortSignal, AbortSignal.timeout(TIMEOUT_MS)]),
    });
    if (!response.ok) return undefined;

    const data = (await response.json()) as LangLinksResponse;
    const pages = Array.isArray(data.query?.pages) ? data.query.pages : [];
    const koreanLink = pages
      .filter((page) => page?.ns === 0 && !page.missing)
      .flatMap((page) => (Array.isArray(page.langlinks) ? page.langlinks : []))
      .find((link) => link?.lang === 'ko');

    return (koreanLink?.title ?? koreanLink?.['*'] ?? '').trim() || undefined;
  } catch {
    // 영어 위키백과 연결 조회가 실패해도 기존 결과는 유지한다.
    return undefined;
  }
}
