import { describe, it, expect, vi } from 'vitest';
import { CACHE_STORAGE_KEY, createLookupCache, type LookupCache } from '../../../lib/lookup/cache';
import { createLookupService } from '../../../lib/lookup/service';
import type { DisambiguationInfo, LookupProvider, LookupResult } from '../../../lib/lookup/types';
import { memoryArea } from '../memory-area';

const FOUND: LookupResult = {
  status: 'found',
  title: 'SaaS',
  extract: '설명',
  url: 'https://ko.wikipedia.org/wiki/SaaS',
  isDisambiguation: false,
};

function fakeProvider(result: LookupResult) {
  return { lookup: vi.fn<LookupProvider['lookup']>(async () => result) };
}

describe('createLookupService', () => {
  it('asks the provider once and then serves from cache', async () => {
    const provider = fakeProvider(FOUND);
    const lookup = createLookupService(provider, createLookupCache(memoryArea()));

    expect(await lookup('SaaS')).toEqual(FOUND);
    expect(await lookup('SaaS')).toEqual(FOUND);
    expect(provider.lookup).toHaveBeenCalledTimes(1);
  });

  it('treats different letter case as the same query', async () => {
    const provider = fakeProvider(FOUND);
    const lookup = createLookupService(provider, createLookupCache(memoryArea()));

    await lookup('SaaS');
    await lookup('saas');

    expect(provider.lookup).toHaveBeenCalledTimes(1);
    expect(provider.lookup).toHaveBeenCalledWith('SaaS');
  });

  it('still returns the provider result when reading the cache fails', async () => {
    const provider = fakeProvider(FOUND);
    const cache: LookupCache = {
      get: async () => {
        throw new Error('storage broken');
      },
      set: async () => undefined,
    };

    expect(await createLookupService(provider, cache)('SaaS')).toEqual(FOUND);
  });

  it('still returns the provider result when writing the cache fails', async () => {
    const provider = fakeProvider(FOUND);
    const cache: LookupCache = {
      get: async () => undefined,
      set: async () => {
        throw new Error('quota exceeded');
      },
    };

    expect(await createLookupService(provider, cache)('SaaS')).toEqual(FOUND);
  });

  it('asks again after a network error', async () => {
    const provider = fakeProvider({ status: 'network_error' });
    const lookup = createLookupService(provider, createLookupCache(memoryArea()));

    await lookup('온보딩');
    await lookup('온보딩');

    expect(provider.lookup).toHaveBeenCalledTimes(2);
  });
});

const url = 'https://ko.wikipedia.org/wiki/x';
const DATABASE = {
  title: '데이터베이스 트리거',
  extract: '테이블에 행이 추가되면 자동으로 실행되는 절차',
  url,
};
const GUN = {
  title: '방아쇠',
  extract: '총의 격발 장치로 손가락으로 당기면 총구에서 탄이 나간다',
  url,
};
const INFO: DisambiguationInfo = {
  basic: [],
  meanings: [
    { label: '데이터베이스 트리거', title: '데이터베이스 트리거' },
    { label: '방아쇠', title: '방아쇠' },
  ],
  candidates: [DATABASE, GUN],
};
const TRIGGER: LookupResult = {
  status: 'found',
  title: '트리거',
  extract: '',
  url,
  isDisambiguation: true,
  disambiguation: INFO,
};
const DB_CONTEXT = '주문 테이블에 행이 추가될 때마다 재고를 줄이도록 트리거를 걸어 두었다.';
const GUN_CONTEXT = '사격장에서 총구 방향을 확인한 뒤 손가락으로 트리거를 당겨 탄을 쐈다.';

describe('suggestions', () => {
  it('picks a sense from the context', async () => {
    const lookup = createLookupService(fakeProvider(TRIGGER), createLookupCache(memoryArea()));

    const result = await lookup('트리거', DB_CONTEXT);

    expect(result.status === 'found' && result.suggestion?.title).toBe('데이터베이스 트리거');
  });

  it('recomputes the suggestion for each context from one cached result', async () => {
    const provider = fakeProvider(TRIGGER);
    const lookup = createLookupService(provider, createLookupCache(memoryArea()));

    const first = await lookup('트리거', DB_CONTEXT);
    const second = await lookup('트리거', GUN_CONTEXT);

    expect(provider.lookup).toHaveBeenCalledTimes(1);
    expect(first.status === 'found' && first.suggestion?.title).toBe('데이터베이스 트리거');
    expect(second.status === 'found' && second.suggestion?.title).toBe('방아쇠');
  });

  it('removes the query word too when the title differs from the query', async () => {
    const echo = { title: '데이터베이스 트리거', extract: 'xyzw xyzw xyzw', url };
    const redirected: LookupResult = {
      ...TRIGGER,
      disambiguation: { ...INFO, candidates: [echo, GUN] },
    };
    const lookup = createLookupService(fakeProvider(redirected), createLookupCache(memoryArea()));

    const result = await lookup('xyzw', 'xyzw xyzw xyzw');

    expect(result.status === 'found' && result.suggestion).toBeFalsy();
  });

  it('gives no suggestion without context', async () => {
    const lookup = createLookupService(fakeProvider(TRIGGER), createLookupCache(memoryArea()));

    const result = await lookup('트리거');

    expect(result.status === 'found' && result.suggestion).toBeFalsy();
  });

  it('never stores the suggestion in the cache', async () => {
    const area = memoryArea();
    const lookup = createLookupService(fakeProvider(TRIGGER), createLookupCache(area));

    await lookup('트리거', DB_CONTEXT);

    expect(JSON.stringify((await area.get(CACHE_STORAGE_KEY))[CACHE_STORAGE_KEY])).not.toContain(
      'suggestion',
    );
  });

  it('does not cache a disambiguation result that lacks the extra information', async () => {
    const bare: LookupResult = { ...TRIGGER, disambiguation: undefined };
    const provider = fakeProvider(bare);
    const lookup = createLookupService(provider, createLookupCache(memoryArea()));

    await lookup('트리거');
    await lookup('트리거');

    expect(provider.lookup).toHaveBeenCalledTimes(2);
  });
});
