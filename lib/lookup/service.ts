import type { LookupCache } from './cache';
import type { LookupProvider, LookupResult } from './types';

export type LookupService = (query: string) => Promise<LookupResult>;

/** 캐시를 먼저 보고, 없으면 출처에 물어 저장한다. 대소문자만 다른 검색어는 같은 것으로 본다. */
export function createLookupService(provider: LookupProvider, cache: LookupCache): LookupService {
  return async (query) => {
    const key = query.toLowerCase();
    const cached = await cache.get(key);
    if (cached) return cached;
    const result = await provider.lookup(query);
    await cache.set(key, result);
    return result;
  };
}
