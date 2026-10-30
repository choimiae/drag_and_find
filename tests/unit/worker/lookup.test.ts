import { describe, expect, it, vi } from 'vitest';
import { lookupSources } from '../../../worker/lookup';
import type { LookupProvider, LookupResult } from '../../../lib/lookup/types';

const naver: LookupResult = {
  status: 'found',
  source: 'naver',
  title: '온보딩',
  extract: '설명',
  url: 'https://terms.naver.com/entry.naver?docId=1',
  isDisambiguation: false,
};
const wiki: LookupResult = {
  status: 'found',
  source: 'wikipedia',
  title: '온보딩',
  extract: '설명',
  url: 'https://ko.wikipedia.org/wiki/온보딩',
  isDisambiguation: false,
};
const provider = (result: LookupResult): LookupProvider => ({ lookup: vi.fn(async () => result) });

describe('lookupSources', () => {
  it('returns the Naver result without calling Wikipedia', async () => {
    const wikipedia = provider(wiki);
    expect(await lookupSources('온보딩', provider(naver), wikipedia)).toEqual(naver);
    expect(wikipedia.lookup).not.toHaveBeenCalled();
  });

  it.each(['not_found', 'rate_limited', 'network_error'] as const)(
    'falls back to Wikipedia on Naver %s',
    async (status) => {
      expect(await lookupSources('온보딩', provider({ status }), provider(wiki))).toEqual(wiki);
    },
  );

  it('returns not_found when neither source has a result', async () => {
    expect(
      await lookupSources(
        '없는말',
        provider({ status: 'not_found' }),
        provider({ status: 'not_found' }),
      ),
    ).toEqual({ status: 'not_found' });
  });
});
