import { describe, expect, it, vi } from 'vitest';
import { withWorkerFailureFallback } from '../../../lib/lookup/fallback-provider';
import type { LookupProvider, LookupResult } from '../../../lib/lookup/types';

const wikiFound: LookupResult = {
  status: 'found',
  source: 'wikipedia',
  title: '고양이',
  extract: '동물',
  url: 'https://ko.wikipedia.org/wiki/고양이',
  isDisambiguation: false,
};

function provider(result: LookupResult): LookupProvider {
  return { lookup: vi.fn(async () => result) };
}

describe('withWorkerFailureFallback', () => {
  it.each(['network_error', 'rate_limited'] as const)(
    'shows Wikipedia for Worker %s',
    async (status) => {
      const wikipedia = provider(wikiFound);
      const result = await withWorkerFailureFallback(provider({ status }), wikipedia).lookup('고양이');
      expect(result).toEqual(wikiFound);
      expect(wikipedia.lookup).toHaveBeenCalledWith('고양이');
    },
  );

  it('keeps a successful Worker result without another request', async () => {
    const wikipedia = provider({ status: 'network_error' });
    const result = await withWorkerFailureFallback(provider(wikiFound), wikipedia).lookup('고양이');
    expect(result).toEqual(wikiFound);
    expect(wikipedia.lookup).not.toHaveBeenCalled();
  });

  it('keeps a Worker not_found result without another request', async () => {
    const wikipedia = provider(wikiFound);
    const result = await withWorkerFailureFallback(
      provider({ status: 'not_found' }),
      wikipedia,
    ).lookup('없는문서');
    expect(result).toEqual({ status: 'not_found' });
    expect(wikipedia.lookup).not.toHaveBeenCalled();
  });

  it('returns the direct lookup error if Wikipedia also fails', async () => {
    const result = await withWorkerFailureFallback(
      provider({ status: 'network_error' }),
      provider({ status: 'rate_limited' }),
    ).lookup('고양이');
    expect(result).toEqual({ status: 'rate_limited' });
  });
});
