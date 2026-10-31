import type { LookupProvider, LookupResult } from '../lib/lookup/types';

/**
 * 두 출처를 동시에 조회해 대기 시간을 줄인다.
 * 위키백과에 실제 뜻 목록이 있을 때만 동음이의 문서를 우선한다.
 * 문맥에 따른 뜻 선택은 주변 문장을 서버로 보내지 않고 확장 프로그램에서 수행한다.
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

  if (first.status === 'found') {
    if (
      second.status === 'found' &&
      second.isDisambiguation &&
      second.disambiguation?.meanings.length
    ) {
      return second;
    }

    return first;
  }

  if (second.status === 'not_found' && first.status !== 'not_found') return first;
  return second;
}

async function safelyLookup(provider: LookupProvider, query: string): Promise<LookupResult> {
  try {
    return await provider.lookup(query);
  } catch {
    return { status: 'network_error' };
  }
}
