import { describe, it, expect } from 'vitest';
import { MAX_CACHE_ENTRIES, createLookupCache } from '../../../lib/lookup/cache';
import type { LookupResult } from '../../../lib/lookup/types';
import { memoryArea } from '../memory-area';

const found = (title: string): LookupResult => ({
  status: 'found',
  title,
  extract: `${title} 설명`,
  url: `https://ko.wikipedia.org/wiki/${title}`,
  isDisambiguation: false,
});

describe('createLookupCache', () => {
  it('returns a stored found result', async () => {
    const cache = createLookupCache(memoryArea());

    await cache.set('온보딩', found('온보딩'));

    expect(await cache.get('온보딩')).toEqual(found('온보딩'));
  });

  it('stores not_found results', async () => {
    const cache = createLookupCache(memoryArea());

    await cache.set('갓생', { status: 'not_found' });

    expect(await cache.get('갓생')).toEqual({ status: 'not_found' });
  });

  it.each([{ status: 'rate_limited' }, { status: 'network_error' }] as const)(
    'does not store $status',
    async (result) => {
      const cache = createLookupCache(memoryArea());

      await cache.set('온보딩', result);

      expect(await cache.get('온보딩')).toBeUndefined();
    },
  );

  it('drops the oldest entry beyond the limit', async () => {
    const cache = createLookupCache(memoryArea());

    for (let index = 0; index <= MAX_CACHE_ENTRIES; index += 1) {
      await cache.set(`q${index}`, found(`q${index}`));
    }

    expect(await cache.get('q0')).toBeUndefined();
    expect(await cache.get('q1')).toEqual(found('q1'));
    expect(await cache.get(`q${MAX_CACHE_ENTRIES}`)).toEqual(found(`q${MAX_CACHE_ENTRIES}`));
  });

  it('ignores a corrupted stored value', async () => {
    const cache = createLookupCache(memoryArea({ lookupCache: 'broken' }));

    expect(await cache.get('온보딩')).toBeUndefined();
  });

  it('skips malformed entries inside the stored array', async () => {
    const cache = createLookupCache(
      memoryArea({ lookupCache: [null, 'x', ['only-key'], [3, {}], ['온보딩', null]] }),
    );

    await expect(cache.get('없는말')).resolves.toBeUndefined();
    await expect(cache.get('온보딩')).resolves.toBeUndefined();
  });
});
