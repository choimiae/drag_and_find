import type { FoundResult, LookupProvider, LookupResult, LookupSourceResult } from '../lib/lookup/types';

/**
 * Worker는 검색어만 받아 두 출처의 결과를 제공한다.
 * 주변 문맥을 알지 못하므로 의미를 선택하거나 네이버 검색 결과를 재정렬하지 않는다.
 */
export async function lookupSources(
  query: string,
  naver: LookupProvider,
  wikipedia: LookupProvider,
): Promise<LookupResult> {
  const [first, second] = await Promise.all([
    safelyLookup(naver, query),
    safelyLookup(wikipedia, query),
  ]);

  if (first.status === 'found' && second.status === 'found') {
    // 위키백과의 뜻 모음을 브라우저의 기존 의미 구분 UI에 전달한다.
    if (second.isDisambiguation) {
      return second.disambiguation?.meanings.length
        ? { ...second, alternatives: [asSource(first)] }
        : first;
    }
    return { ...first, alternatives: [asSource(second)] };
  }
  if (first.status === 'found') return first;
  if (second.status === 'found') return second;
  if (second.status === 'not_found' && first.status !== 'not_found') return first;
  return second;
}

function asSource(result: FoundResult): LookupSourceResult {
  const { source, title, extract, url, isDisambiguation, disambiguation } = result;
  return {
    source: source ?? 'wikipedia',
    title,
    extract,
    url,
    isDisambiguation,
    ...(disambiguation ? { disambiguation } : {}),
  };
}

async function safelyLookup(provider: LookupProvider, query: string): Promise<LookupResult> {
  try {
    return await provider.lookup(query);
  } catch {
    return { status: 'network_error' };
  }
}
