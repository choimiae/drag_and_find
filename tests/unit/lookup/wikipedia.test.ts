import { describe, it, expect, vi } from 'vitest';
import {
  createWikipediaKoProvider,
  isRelevantTitle,
  type FetchFn,
} from '../../../lib/lookup/wikipedia';
import { linkedResponse, parseResponse } from '../fixtures/disambiguation/load';

const SUMMARY_PATH = '/api/rest_v1/page/summary/';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const summary = (title: string, extra: Record<string, unknown> = {}) =>
  json({
    type: 'standard',
    title,
    extract: `${title} 설명`,
    content_urls: {
      desktop: { page: `https://ko.wikipedia.org/wiki/${encodeURIComponent(title)}` },
    },
    ...extra,
  });

const notFound = () => json({ type: 'not_found' }, 404);
const searchHits = (titles: string[]) =>
  json({ query: { search: titles.map((title) => ({ title })) } });

const summaryTitleOf = (url: URL) => decodeURIComponent(url.pathname.slice(SUMMARY_PATH.length));
const isSummary = (url: URL) => url.pathname.startsWith(SUMMARY_PATH);

function fakeFetch(route: (url: URL) => Response | Promise<Response>) {
  const fn = vi.fn<FetchFn>(async (input) => route(new URL(input)));
  return fn;
}

function provider(fetchFn: FetchFn) {
  return createWikipediaKoProvider({ userAgent: 'DragAndFind/test', fetchFn });
}

describe('createWikipediaKoProvider', () => {
  it('returns the summary of an exactly matching article', async () => {
    const fetchFn = fakeFetch((url) =>
      summaryTitleOf(url) === '온보딩' ? summary('온보딩') : notFound(),
    );

    const result = await provider(fetchFn).lookup('온보딩');

    expect(result).toEqual({
      status: 'found',
      title: '온보딩',
      extract: '온보딩 설명',
      url: 'https://ko.wikipedia.org/wiki/%EC%98%A8%EB%B3%B4%EB%94%A9',
      isDisambiguation: false,
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('sends the Api-User-Agent header and a timeout signal', async () => {
    const fetchFn = fakeFetch(() => summary('온보딩'));

    await provider(fetchFn).lookup('온보딩');

    const init = fetchFn.mock.calls[0]?.[1];
    expect(init?.headers).toEqual({ 'Api-User-Agent': 'DragAndFind/test' });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('follows redirects returned by the summary endpoint', async () => {
    const fetchFn = fakeFetch(() => summary('서비스형 소프트웨어'));

    const result = await provider(fetchFn).lookup('SaaS');

    expect(result).toMatchObject({ status: 'found', title: '서비스형 소프트웨어' });
  });

  it('marks disambiguation pages', async () => {
    const fetchFn = fakeFetch(() => summary('POC', { type: 'disambiguation' }));

    const result = await provider(fetchFn).lookup('POC');

    expect(result).toMatchObject({ status: 'found', isDisambiguation: true });
  });

  it('encodes titles that contain a slash', async () => {
    const fetchFn = fakeFetch(() => summary('TCP/IP'));

    await provider(fetchFn).lookup('TCP/IP');

    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      'https://ko.wikipedia.org/api/rest_v1/page/summary/TCP%2FIP',
    );
  });

  it('replaces a non-Wikipedia article url with a ko.wikipedia.org url', async () => {
    const fetchFn = fakeFetch(() =>
      summary('온보딩', { content_urls: { desktop: { page: 'https://evil.example/x' } } }),
    );

    const result = await provider(fetchFn).lookup('온보딩');

    expect(result).toMatchObject({
      url: 'https://ko.wikipedia.org/wiki/%EC%98%A8%EB%B3%B4%EB%94%A9',
    });
  });

  it('falls back to search and accepts a title that contains the query', async () => {
    const fetchFn = fakeFetch((url) => {
      if (!isSummary(url)) return searchHits(['마케팅 퍼널']);
      return summaryTitleOf(url) === '마케팅 퍼널' ? summary('마케팅 퍼널') : notFound();
    });

    const result = await provider(fetchFn).lookup('퍼널');

    expect(result).toMatchObject({ status: 'found', title: '마케팅 퍼널' });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('accepts a title the query starts with, for words with a particle attached', async () => {
    const fetchFn = fakeFetch((url) => {
      if (!isSummary(url)) return searchHits(['온보딩']);
      return summaryTitleOf(url) === '온보딩' ? summary('온보딩') : notFound();
    });

    const result = await provider(fetchFn).lookup('온보딩을');

    expect(result).toMatchObject({ status: 'found', title: '온보딩' });
  });

  it.each([
    ['이탈률', '유체이탈'],
    ['갓생', '세조 (조선)'],
    ['리스킬링', '유재석'],
  ])('rejects an unrelated search hit (%s → %s)', async (query, hit) => {
    const fetchFn = fakeFetch((url) => (isSummary(url) ? notFound() : searchHits([hit])));

    const result = await provider(fetchFn).lookup(query);

    expect(result).toEqual({ status: 'not_found' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('returns not_found when search has no hits', async () => {
    const fetchFn = fakeFetch((url) => (isSummary(url) ? notFound() : searchHits([])));

    expect(await provider(fetchFn).lookup('없는말')).toEqual({ status: 'not_found' });
  });

  it('returns rate_limited on 429 without retrying', async () => {
    const fetchFn = fakeFetch(() => new Response('', { status: 429 }));

    expect(await provider(fetchFn).lookup('온보딩')).toEqual({ status: 'rate_limited' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('retries once after a server error', async () => {
    let calls = 0;
    const fetchFn = fakeFetch(() => {
      calls += 1;
      return calls === 1 ? new Response('', { status: 503 }) : summary('온보딩');
    });

    expect(await provider(fetchFn).lookup('온보딩')).toMatchObject({ status: 'found' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('returns network_error after the retry also fails', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => {
      throw new TypeError('Failed to fetch');
    });

    expect(await provider(fetchFn).lookup('온보딩')).toEqual({ status: 'network_error' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe('isRelevantTitle', () => {
  it('accepts titles containing the query, ignoring case and spaces', () => {
    expect(isRelevantTitle('퍼널', '마케팅 퍼널')).toBe(true);
    expect(isRelevantTitle('saas', 'SaaS')).toBe(true);
    expect(isRelevantTitle('마케팅퍼널', '마케팅 퍼널')).toBe(true);
  });

  it('accepts a title the query starts with only when the title has 2+ characters', () => {
    expect(isRelevantTitle('온보딩을', '온보딩')).toBe(true);
    expect(isRelevantTitle('가나다', '가')).toBe(false);
  });

  it('rejects unrelated titles', () => {
    expect(isRelevantTitle('이탈률', '유체이탈')).toBe(false);
    expect(isRelevantTitle('PoC', '개념 증명')).toBe(false);
  });
});

function disambiguationFetch(
  word: string,
  overrides: { linked?: () => Response; parse?: () => Response } = {},
) {
  return fakeFetch((url) => {
    if (isSummary(url)) {
      return summaryTitleOf(url) === word
        ? summary(word, { type: 'disambiguation', extract: `${word}는 다음 뜻으로 쓰인다.` })
        : notFound();
    }
    if (url.searchParams.get('action') === 'parse') {
      return overrides.parse?.() ?? json(parseResponse(word));
    }
    if (url.searchParams.get('generator') === 'links') {
      return overrides.linked?.() ?? json(linkedResponse(word));
    }
    return notFound();
  });
}

describe('disambiguation pages', () => {
  it('adds basic meanings, meanings and candidates with two extra requests', async () => {
    const fetchFn = disambiguationFetch('트리거');

    const result = await provider(fetchFn).lookup('트리거');

    expect(fetchFn).toHaveBeenCalledTimes(3);
    const parseUrl = fetchFn.mock.calls
      .map(([input]) => new URL(String(input)))
      .find((url) => url.searchParams.get('action') === 'parse');
    expect(parseUrl?.searchParams.get('page')).toBe('트리거');
    expect(parseUrl?.searchParams.get('prop')).toBe('text|links');
    expect(parseUrl?.searchParams.get('formatversion')).toBe('2');
    expect(result).toMatchObject({ status: 'found', isDisambiguation: true });
    if (result.status !== 'found' || !result.disambiguation) throw new Error('no disambiguation');
    expect(result.disambiguation.basic).toHaveLength(2);
    expect(result.disambiguation.meanings).toContainEqual({
      label: '데이터베이스 트리거',
      title: '데이터베이스 트리거',
    });
    expect(result.disambiguation.candidates.map((c) => c.title)).toContain('방아쇠');
  });

  it('excludes the dictionary project page and builds Wikipedia urls for candidates', async () => {
    const result = await provider(disambiguationFetch('커널')).lookup('커널');

    if (result.status !== 'found' || !result.disambiguation) throw new Error('no disambiguation');
    const titles = result.disambiguation.candidates.map((c) => c.title);
    expect(titles).not.toContain('위키낱말사전');
    for (const candidate of result.disambiguation.candidates) {
      expect(candidate.url).toBe(
        `https://ko.wikipedia.org/wiki/${encodeURIComponent(candidate.title)}`,
      );
    }
  });

  it('makes meanings that link to redirect pages clickable', async () => {
    const result = await provider(disambiguationFetch('모델')).lookup('모델');

    if (result.status !== 'found' || !result.disambiguation) throw new Error('no disambiguation');
    const business = result.disambiguation.meanings.find((m) =>
      m.label.startsWith('비즈니스 모델'),
    );
    expect(business?.title).toBe('비즈니스 모델');
    expect(result.disambiguation.candidates.map((c) => c.title)).not.toContain('비즈니스 모델');
  });

  it('links a sentence-form item to its first article link', async () => {
    const result = await provider(disambiguationFetch('마진')).lookup('마진');

    if (result.status !== 'found' || !result.disambiguation) throw new Error('no disambiguation');
    const measles = result.disambiguation.meanings.find((m) => m.label.startsWith('마진(痲疹)은'));
    expect(measles?.title).toBe('홍역');
  });

  it('keeps the plain disambiguation result when the parse response has no text', async () => {
    const fetchFn = disambiguationFetch('트리거', { parse: () => json({ parse: { links: [] } }) });

    const result = await provider(fetchFn).lookup('트리거');

    expect(result).toMatchObject({ status: 'found', isDisambiguation: true });
    expect(result.status === 'found' && result.disambiguation).toBeFalsy();
  });

  it('keeps the plain disambiguation result when links is not an array', async () => {
    const fetchFn = disambiguationFetch('트리거', {
      parse: () => json({ parse: { text: '<ul></ul>', links: 'x' } }),
    });

    const result = await provider(fetchFn).lookup('트리거');

    expect(result).toMatchObject({ status: 'found', isDisambiguation: true });
    expect(result.status === 'found' && result.disambiguation).toBeFalsy();
  });

  it('ignores malformed link entries', async () => {
    const fetchFn = disambiguationFetch('트리거', {
      parse: () =>
        json({
          parse: {
            text: '<ul><li><a href="/wiki/A">A</a></li></ul>',
            links: [{ ns: 0, title: 'A' }, 'junk', null],
          },
        }),
    });

    const result = await provider(fetchFn).lookup('트리거');

    if (result.status !== 'found' || !result.disambiguation) throw new Error('no disambiguation');
    expect(result.disambiguation.meanings).toEqual([{ label: 'A', title: null }]);
  });

  it('keeps the plain disambiguation result when an extra request fails', async () => {
    const fetchFn = disambiguationFetch('트리거', {
      linked: () => new Response('', { status: 429 }),
    });

    const result = await provider(fetchFn).lookup('트리거');

    expect(result).toMatchObject({ status: 'found', isDisambiguation: true });
    expect(result.status === 'found' && result.disambiguation).toBeFalsy();
  });

  it('excludes linked pages whose extract is not a string', async () => {
    const linked = linkedResponse('트리거');
    const broken = {
      query: { pages: { ...linked.query?.pages, '999999': { title: '숫자 문서', extract: 5 } } },
    };
    const fetchFn = disambiguationFetch('트리거', { linked: () => json(broken) });

    const result = await provider(fetchFn).lookup('트리거');

    if (result.status !== 'found' || !result.disambiguation) throw new Error('no disambiguation');
    expect(result.disambiguation.candidates.map((c) => c.title)).not.toContain('숫자 문서');
  });

  it('keeps the plain disambiguation result when the parse request fails to connect', async () => {
    const fetchFn = fakeFetch((url) => {
      if (isSummary(url)) {
        return summary('트리거', {
          type: 'disambiguation',
          extract: '트리거는 다음 뜻으로 쓰인다.',
        });
      }
      if (url.searchParams.get('generator') === 'links') return json(linkedResponse('트리거'));
      if (url.searchParams.get('action') === 'parse') throw new TypeError('Failed to fetch');
      return notFound();
    });

    const result = await provider(fetchFn).lookup('트리거');

    expect(result).toMatchObject({ status: 'found', isDisambiguation: true });
    expect(result.status === 'found' && result.disambiguation).toBeFalsy();
  });

  it('makes no extra request for a normal article', async () => {
    const fetchFn = fakeFetch(() => summary('온보딩'));

    await provider(fetchFn).lookup('온보딩');

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
