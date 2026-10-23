import { describe, it, expect, vi } from 'vitest';
import { createLookupCache } from '../../../lib/lookup/cache';
import { createLookupService } from '../../../lib/lookup/service';
import type { LookupProvider, LookupResult } from '../../../lib/lookup/types';
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

  it('asks again after a network error', async () => {
    const provider = fakeProvider({ status: 'network_error' });
    const lookup = createLookupService(provider, createLookupCache(memoryArea()));

    await lookup('온보딩');
    await lookup('온보딩');

    expect(provider.lookup).toHaveBeenCalledTimes(2);
  });
});
