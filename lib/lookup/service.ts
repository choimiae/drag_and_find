import type { LookupCache } from './cache';
import { pickSense } from './sense';
import type { LookupProvider, LookupResult } from './types';

export type LookupService = (query: string, context?: string) => Promise<LookupResult>;

/**
 * 캐시를 먼저 보고, 없으면 출처에 물어 저장한다. 대소문자만 다른 검색어는 같은 것으로 본다.
 * 문맥에 따른 뜻 선택은 저장하지 않고 찾을 때마다 계산한다.
 */
export function createLookupService(provider: LookupProvider, cache?: LookupCache): LookupService {
  return async (query, context) => {
    if (!cache) return withSuggestion(await provider.lookup(query), query, context);
    const key = query.toLowerCase();
    const cached = await cache.get(key).catch(() => undefined); // 캐시는 속도를 위한 것이라 읽기 실패는 없는 것으로 본다
    const result = cached ?? (await provider.lookup(query));
    if (!cached && isWorthCaching(result)) {
      await cache.set(key, result).catch(() => undefined); // 캐시는 속도를 위한 것이라 저장 실패로 찾은 결과를 버리지 않는다
    }
    return withSuggestion(result, query, context);
  };
}

/** 뜻 모음인데 추가 정보가 없으면(추가 요청 실패) 다음에 다시 받아 오도록 저장하지 않는다. */
function isWorthCaching(result: LookupResult): boolean {
  return !(result.status === 'found' && result.isDisambiguation && !result.disambiguation);
}

function withSuggestion(
  result: LookupResult,
  query: string,
  context: string | undefined,
): LookupResult {
  if (result.status !== 'found' || !result.disambiguation || !context) return result;
  const suggestion = pickSense(context, [query, result.title], result.disambiguation.candidates);
  return suggestion ? { ...result, suggestion } : result;
}
