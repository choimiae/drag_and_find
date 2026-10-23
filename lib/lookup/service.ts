import type { LookupCache } from './cache';
import type { LookupProvider, LookupResult } from './types';

export type LookupService = (query: string) => Promise<LookupResult>;

/** 캐시를 먼저 보고, 없으면 출처에 물어 저장한다. 대소문자만 다른 검색어는 같은 것으로 본다. */
export function createLookupService(provider: LookupProvider, cache: LookupCache): LookupService {
  return async (query) => {
    const key = query.toLowerCase();
    const cached = await cache.get(key).catch(() => undefined); // 캐시는 속도를 위한 것이라 읽기 실패는 없는 것으로 본다
    if (cached) return cached;
    const result = await provider.lookup(query);
    await cache.set(key, result).catch(() => undefined); // 캐시는 속도를 위한 것이라 저장 실패로 찾은 결과를 버리지 않는다
    return result;
  };
}
