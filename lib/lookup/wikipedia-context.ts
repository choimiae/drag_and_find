import type { FetchFn } from './wikipedia';

export const MAX_ENGLISH_CONTEXT_TITLES = 8;
const TIMEOUT_MS = 5000;

interface WikiPage {
  ns?: number;
  title?: string;
  extract?: string;
  langlinks?: Array<{ lang?: string; title?: string; '*'?: string }>;
}

interface WikiResponse {
  query?: { pages?: WikiPage[] };
}

/** 한국어 후보 문서 제목의 영어 설명을 조회한다. 주변 문맥은 받지 않는다. */
export async function fetchEnglishExtracts(
  titles: string[],
  userAgent: string,
  fetchFn: FetchFn = fetch,
): Promise<Record<string, string>> {
  async function request(origin: string, params: URLSearchParams): Promise<WikiResponse | null> {
    const response = await fetchFn(`${origin}/w/api.php?${params}`, {
      headers: { 'User-Agent': userAgent, 'Api-User-Agent': userAgent },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.ok ? ((await response.json()) as WikiResponse) : null;
  }

  try {
    const koParams = new URLSearchParams({
      action: 'query',
      prop: 'langlinks',
      titles: titles.join('|'),
      lllang: 'en',
      lllimit: '1',
      redirects: '1',
      format: 'json',
      formatversion: '2',
    });
    const koData = await request('https://ko.wikipedia.org', koParams);
    const englishTitles = new Map<string, string>();
    const requested = new Set(titles);
    for (const page of koData?.query?.pages ?? []) {
      if (page.ns !== 0 || !page.title || !requested.has(page.title)) continue;
      const link = page.langlinks?.find((item) => item.lang === 'en');
      const englishTitle = link?.title ?? link?.['*'];
      if (englishTitle) englishTitles.set(page.title, englishTitle);
    }
    if (englishTitles.size === 0) return {};

    const enParams = new URLSearchParams({
      action: 'query',
      prop: 'extracts',
      titles: [...new Set(englishTitles.values())].join('|'),
      exintro: '1',
      explaintext: '1',
      exchars: '500',
      exlimit: String(MAX_ENGLISH_CONTEXT_TITLES),
      redirects: '1',
      format: 'json',
      formatversion: '2',
    });
    const enData = await request('https://en.wikipedia.org', enParams);
    const englishExtracts = new Map<string, string>();
    for (const page of enData?.query?.pages ?? []) {
      if (page.title && page.extract) englishExtracts.set(page.title, page.extract);
    }
    const extracts: Record<string, string> = {};
    for (const [koreanTitle, englishTitle] of englishTitles) {
      const extract = englishExtracts.get(englishTitle);
      if (extract) extracts[koreanTitle] = extract;
    }
    return extracts;
  } catch {
    return {};
  }
}
