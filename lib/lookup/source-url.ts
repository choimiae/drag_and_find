import type { FoundResult } from './types';

const SOURCE_HOSTS: Record<NonNullable<FoundResult['source']>, ReadonlySet<string>> = {
  naver: new Set(['terms.naver.com']),
  wikipedia: new Set(['ko.wikipedia.org', 'en.wikipedia.org']),
  wikidata: new Set(['www.wikidata.org']),
};

/** 원문 표시용 URL이 표시된 출처의 HTTPS 주소인지 검사한다. */
export function safeSourceUrl(source: FoundResult['source'], raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    return SOURCE_HOSTS[source ?? 'wikipedia'].has(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}
