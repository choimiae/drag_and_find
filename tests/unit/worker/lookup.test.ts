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
const ambiguity: LookupResult = {
  status: 'found',
  source: 'wikipedia',
  title: 'RAG',
  extract: '여러 뜻이 있다',
  url: 'https://ko.wikipedia.org/wiki/RAG',
  isDisambiguation: true,
  disambiguation: {
    basic: [],
    meanings: [{ label: '검색증강생성', title: '검색증강생성' }],
    candidates: [
      {
        title: '검색증강생성',
        extract: '외부 지식을 검색해 언어 모델의 응답 생성에 활용하는 기술',
        url: 'https://ko.wikipedia.org/wiki/검색증강생성',
      },
    ],
  },
};
const provider = (result: LookupResult): LookupProvider => ({ lookup: vi.fn(async () => result) });

describe('lookupSources', () => {
  it('keeps Naver when Wikipedia returns a regular article', async () => {
    expect(await lookupSources('온보딩', provider(naver), provider(wiki))).toEqual(naver);
  });

  it('uses a Wikipedia disambiguation result with actual meanings', async () => {
    expect(await lookupSources('RAG', provider(naver), provider(ambiguity))).toEqual(ambiguity);
  });

  it('keeps Naver if Wikipedia could not load the meaning list', async () => {
    const incomplete: LookupResult = {
      status: 'found',
      source: 'wikipedia',
      title: 'RAG',
      extract: '',
      url: 'https://ko.wikipedia.org/wiki/RAG',
      isDisambiguation: true,
    };
    expect(await lookupSources('RAG', provider(naver), provider(incomplete))).toEqual(naver);
  });

  it('keeps Naver when the Wikipedia meaning list is empty', async () => {
    const empty: LookupResult = {
      ...ambiguity,
      status: 'found',
      disambiguation: { basic: [], meanings: [], candidates: [] },
    };
    expect(await lookupSources('RAG', provider(naver), provider(empty))).toEqual(naver);
  });

  it.each(['not_found', 'rate_limited', 'network_error'] as const)(
    'keeps Naver when Wikipedia reports %s',
    async (status) => {
      expect(await lookupSources('온보딩', provider(naver), provider({ status }))).toEqual(naver);
    },
  );

  it.each(['not_found', 'rate_limited', 'network_error'] as const)(
    'falls back to Wikipedia when Naver reports %s',
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

  it('treats thrown provider errors as network errors and preserves a valid result', async () => {
    const failing: LookupProvider = {
      lookup: vi.fn(async () => {
        throw new Error('offline');
      }),
    };
    expect(await lookupSources('온보딩', provider(naver), failing)).toEqual(naver);
    expect(await lookupSources('온보딩', failing, provider(wiki))).toEqual(wiki);
  });

  it('starts the Wikipedia request before Naver has finished', async () => {
    let finishNaver: ((value: LookupResult) => void) | undefined;
    const slowNaver: LookupProvider = {
      lookup: vi.fn(
        () => new Promise<LookupResult>((resolve) => { finishNaver = resolve; }),
      ),
    };
    const wikipedia = provider(wiki);

    const pending = lookupSources('온보딩', slowNaver, wikipedia);
    expect(wikipedia.lookup).toHaveBeenCalledWith('온보딩');
    finishNaver?.(naver);
    await expect(pending).resolves.toEqual(naver);
  });
});
