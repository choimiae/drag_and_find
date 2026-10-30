import type { LookupProvider, LookupResult } from '../lib/lookup/types';

/** 출처 순서는 서버만 결정한다. 네이버가 결과를 주면 위키백과는 호출하지 않는다. */
export async function lookupSources(
  query: string,
  naver: LookupProvider,
  wikipedia: LookupProvider,
): Promise<LookupResult> {
  let first: LookupResult;
  try {
    first = await naver.lookup(query);
  } catch {
    first = { status: 'network_error' };
  }
  if (first.status === 'found') return first;
  try {
    const second = await wikipedia.lookup(query);
    if (second.status === 'not_found' && first.status !== 'not_found') return first;
    return second;
  } catch {
    return first.status === 'not_found' ? { status: 'network_error' } : first;
  }
}
