import { describe, expect, it, vi } from 'vitest';
import { createBrowserWikipediaProvider } from '../../../lib/lookup/browser-wikipedia';
import type { FetchFn } from '../../../lib/lookup/wikipedia';

describe('createBrowserWikipediaProvider', () => {
  it('looks up a Korean article directly and identifies the app with Api-User-Agent', async () => {
    const fetchFn = vi.fn<FetchFn>(async (input, init) => {
      expect(new URL(input).hostname).toBe('ko.wikipedia.org');
      expect(new Headers(init?.headers).has('Api-User-Agent')).toBe(true);
      expect(new Headers(init?.headers).has('User-Agent')).toBe(false);
      return Response.json({
        title: '고양이',
        extract: '동물',
        content_urls: { desktop: { page: 'https://ko.wikipedia.org/wiki/고양이' } },
      });
    });

    expect(await createBrowserWikipediaProvider(fetchFn).lookup('고양이')).toEqual({
      status: 'found',
      source: 'wikipedia',
      title: '고양이',
      extract: '동물',
      url: 'https://ko.wikipedia.org/wiki/고양이',
      isDisambiguation: false,
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('uses the English Wikipedia Korean language link for an English query', async () => {
    const seenHosts: string[] = [];
    const fetchFn: FetchFn = async (input, init) => {
      const url = new URL(input);
      seenHosts.push(url.hostname);
      expect(new Headers(init?.headers).has('User-Agent')).toBe(false);
      expect(new Headers(init?.headers).has('Api-User-Agent')).toBe(true);
      if (url.hostname === 'en.wikipedia.org') {
        return Response.json({
          query: {
            pages: [{ ns: 0, title: 'Management', langlinks: [{ lang: 'ko', title: '경영' }] }],
          },
        });
      }
      if (url.pathname.endsWith('/summary/Management')) return new Response(null, { status: 404 });
      if (url.pathname === '/w/api.php') return Response.json({ query: { search: [] } });
      return Response.json({
        title: '경영',
        extract: '조직을 운영하는 일',
        content_urls: { desktop: { page: 'https://ko.wikipedia.org/wiki/경영' } },
      });
    };

    const result = await createBrowserWikipediaProvider(fetchFn).lookup('Management');
    expect(result.status).toBe('found');
    if (result.status === 'found') expect(result.title).toBe('경영');
    expect(seenHosts).toContain('en.wikipedia.org');
  });
});
