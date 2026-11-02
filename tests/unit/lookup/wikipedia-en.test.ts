import { describe, expect, it, vi } from 'vitest';
import { withEnglishWikipediaFallback } from '../../../lib/lookup/wikipedia-en';
import type { LookupProvider, LookupResult } from '../../../lib/lookup/types';
import type { FetchFn } from '../../../lib/lookup/wikipedia';

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
