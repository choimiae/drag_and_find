import { describe, expect, it, vi } from 'vitest';
import { withEnglishWikipediaFallback } from '../../../lib/lookup/wikipedia-en';
import type { LookupProvider, LookupResult } from '../../../lib/lookup/types';
import type { DirectMissLookupProvider, FetchFn } from '../../../lib/lookup/wikipedia';

const FOUND: LookupResult = {
  status: 'found',
  source: 'wikipedia',
  title: '경영',
  extract: '조직에 관한 의사결정을 행하는 행동',
  url: 'https://ko.wikipedia.org/wiki/경영',
  isDisambiguation: false,
};

function koreanProvider(): LookupProvider {
  return {
    lookup: vi.fn(async (query: string): Promise<LookupResult> => {
      return query === '경영' ? FOUND : { status: 'not_found' };
    }),
  };
}

function englishFetch(title?: string): ReturnType<typeof vi.fn<FetchFn>> {
  return vi.fn<FetchFn>(async () =>
    Response.json({
      query: {
        pages: [
          {
            ns: 0,
            title: 'Management',
            ...(title
              ? {
                  langlinks: [{ lang: 'ko', title }],
                }
              : {}),
          },
        ],
      },
    }),
  );
}

describe('withEnglishWikipediaFallback', () => {
  it('starts English langlink lookup before the Korean lookup finishes', async () => {
    let finishKorean: ((result: LookupResult) => void) | undefined;
    const korean: DirectMissLookupProvider = {
      lookup: vi.fn(async (query) => {
        if (query === '경영') return FOUND;
        throw new Error('use direct-miss hook for original query');
      }),
      lookupWithDirectMiss: vi.fn((query, onDirectMiss) => {
        if (query !== 'Management') return Promise.resolve(FOUND);
        onDirectMiss();
        return new Promise<LookupResult>((resolve) => {
          finishKorean = resolve;
        });
      }),
    };
    const fetchFn = englishFetch('경영');
    const provider = withEnglishWikipediaFallback(korean, {
      userAgent: 'DragAndFind/test',
      fetchFn,
    });

    const pending = provider.lookup('Management');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(korean.lookupWithDirectMiss).toHaveBeenCalledTimes(1);
    finishKorean?.({ status: 'not_found' });
    await expect(pending).resolves.toEqual(FOUND);
  });

  it('does not start English lookup when the direct Korean article is found', async () => {
    const fetchFn = englishFetch('경영');
    const korean: DirectMissLookupProvider = {
      lookup: vi.fn(async () => {
        throw new Error('use direct-miss hook');
      }),
      lookupWithDirectMiss: vi.fn(async () => FOUND),
    };

    const result = await withEnglishWikipediaFallback(korean, {
      userAgent: 'DragAndFind/test',
      fetchFn,
    }).lookup('Management');

    expect(result).toEqual(FOUND);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('aborts unused English lookup when Korean search finds an article', async () => {
    let englishSignal: AbortSignal | undefined;
    const fetchFn = vi.fn<FetchFn>(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          englishSignal = init?.signal ?? undefined;
          englishSignal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const korean: DirectMissLookupProvider = {
      lookup: vi.fn(async () => {
        throw new Error('use direct-miss hook');
      }),
      lookupWithDirectMiss: async (_query, onDirectMiss) => {
        onDirectMiss();
        return FOUND;
      },
    };

    const result = await withEnglishWikipediaFallback(korean, {
      userAgent: 'DragAndFind/test',
      fetchFn,
    }).lookup('Management');

    expect(result).toEqual(FOUND);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(englishSignal?.aborted).toBe(true);
  });

  it('영어 문서의 한국어 연결 문서를 조회한다', async () => {
    const korean = koreanProvider();
    const fetchFn = englishFetch('경영');

    const provider = withEnglishWikipediaFallback(korean, {
      userAgent: 'DragAndFind/test',
      fetchFn,
    });

    const result = await provider.lookup('Management');

    expect(result).toEqual(FOUND);
    expect(korean.lookup).toHaveBeenCalledWith('Management');
    expect(korean.lookup).toHaveBeenCalledWith('경영');

    const url = new URL(fetchFn.mock.calls[0]![0]);

    expect(url.hostname).toBe('en.wikipedia.org');
    expect(url.searchParams.get('prop')).toBe('langlinks');
    expect(url.searchParams.get('lllang')).toBe('ko');
    expect(url.searchParams.get('redirects')).toBe('1');
  });

  it('한국어 검색어는 영어 위키백과에 요청하지 않는다', async () => {
    const fetchFn = englishFetch('경영');

    const result = await withEnglishWikipediaFallback(koreanProvider(), {
      userAgent: 'DragAndFind/test',
      fetchFn,
    }).lookup('사용량');

    expect(result).toEqual({ status: 'not_found' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('한국어 연결 문서가 없으면 기존 결과를 유지한다', async () => {
    const fetchFn = englishFetch();

    const result = await withEnglishWikipediaFallback(koreanProvider(), {
      userAgent: 'DragAndFind/test',
      fetchFn,
    }).lookup('RAG');

    expect(result).toEqual({ status: 'not_found' });
  });

  it('영어 위키백과 요청이 실패해도 기존 결과를 유지한다', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => new Response('', { status: 503 }));

    const result = await withEnglishWikipediaFallback(koreanProvider(), {
      userAgent: 'DragAndFind/test',
      fetchFn,
    }).lookup('Management');

    expect(result).toEqual({ status: 'not_found' });
  });
});
