import type { LookupProvider } from './types';
import { createWikipediaKoProvider, type FetchFn } from './wikipedia';
import { withEnglishWikipediaFallback } from './wikipedia-en';

const USER_AGENT = 'DragAndFind/1.0.1 (https://github.com/choimiae/drag_and_find)';

/** 브라우저 fetch에서는 User-Agent를 직접 설정할 수 없으므로 API용 헤더만 보낸다. */
export function createBrowserWikipediaProvider(fetchFn: FetchFn = fetch): LookupProvider {
  const browserFetch: FetchFn = (input, init) => {
    const headers = new Headers(init?.headers);
    headers.delete('User-Agent');
    return fetchFn(input, { ...init, headers });
  };
  const korean = createWikipediaKoProvider({ userAgent: USER_AGENT, fetchFn: browserFetch });
  return withEnglishWikipediaFallback(korean, { userAgent: USER_AGENT, fetchFn: browserFetch });
}
