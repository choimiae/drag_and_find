import type { KeyValueArea } from '../storage';
import type { LookupResult } from './types';

export const CACHE_STORAGE_KEY = 'lookupCache';
export const MAX_CACHE_ENTRIES = 200;

type CacheableResult = Extract<LookupResult, { status: 'found' | 'not_found' }>;
type CacheEntry = [query: string, result: CacheableResult];

export interface LookupCache {
  get(query: string): Promise<LookupResult | undefined>;
  set(query: string, result: LookupResult): Promise<void>;
}

/** 조회 결과를 저장소에 오래된 순으로 최대 200건까지 보관한다. 오류 결과는 보관하지 않는다. */
export function createLookupCache(area: KeyValueArea): LookupCache {
  async function readEntries(): Promise<CacheEntry[]> {
    const stored = (await area.get(CACHE_STORAGE_KEY))[CACHE_STORAGE_KEY];
    return Array.isArray(stored) ? (stored as CacheEntry[]) : [];
  }

  return {
    async get(query) {
      return (await readEntries()).find(([key]) => key === query)?.[1];
    },
    async set(query, result) {
      if (result.status !== 'found' && result.status !== 'not_found') return;
      const others = (await readEntries()).filter(([key]) => key !== query);
      const next: CacheEntry[] = [...others, [query, result] as CacheEntry].slice(
        -MAX_CACHE_ENTRIES,
      );
      await area.set({ [CACHE_STORAGE_KEY]: next });
    },
  };
}
