import { describe, expect, it } from 'vitest';
import { createWorkerHandler } from '../../../worker/index';
import { linkedResponse, parseResponse } from '../fixtures/disambiguation/load';

const env = { NAVER_CLIENT_ID: 'id', NAVER_CLIENT_SECRET: 'secret' };

describe('createWorkerHandler', () => {
  it('uses an exact Wikidata alias when both encyclopedias miss 모노레포', async () => {
    const handler = createWorkerHandler(env, async (input) => {
      const url = new URL(input);
      if (url.hostname.includes('naverapihub')) return Response.json({ items: [] });
      if (url.hostname === 'ko.wikipedia.org') {
        if (url.pathname.includes('/summary/')) return new Response('', { status: 404 });
        return Response.json({ query: { search: [] } });
      }
      if (url.hostname === 'en.wikipedia.org') return Response.json({ query: { pages: [] } });
      if (url.hostname === 'www.wikidata.org') {
        if (url.searchParams.get('action') === 'wbsearchentities')
          return Response.json({
            search: [{ id: 'Q1', match: { type: 'alias', language: 'ko', text: '모노레포' } }],
          });
        return Response.json({
          entities: {
            Q1: {
              id: 'Q1',
              labels: { ko: { value: '모노리포' }, en: { value: 'monorepo' } },
              descriptions: { ko: { value: '여러 프로젝트를 하나의 저장소에서 관리하는 방식' } },
            },
          },
        });
      }
      throw new Error(`unexpected request: ${input}`);
    });

    const response = await handler(new Request('https://worker.example/lookup?query=모노레포'));
    expect(await response.json()).toMatchObject({
      status: 'found',
      source: 'wikidata',
      title: '모노리포',
      extract: '여러 프로젝트를 하나의 저장소에서 관리하는 방식',
    });
  });

  it('resolves SSOT to its Korean Wikipedia article and excludes an unrelated Naver hit', async () => {
    const handler = createWorkerHandler(env, async (input) => {
      const url = new URL(input);
      if (url.hostname.includes('naverapihub'))
        return Response.json({
          items: [
            {
              title: '삼성옥틸로늄정',
              description: '위장관 경련 치료제',
              link: 'https://terms.naver.com/entry.naver?docId=1',
            },
          ],
        });
      if (url.hostname === 'ko.wikipedia.org') {
        if (url.pathname.includes('/summary/')) {
          if (decodeURIComponent(url.pathname).endsWith('/단일 진실 공급원'))
            return Response.json({
              type: 'standard',
              title: '단일 진실 공급원',
              extract: '정보를 한 곳에서만 제어하거나 편집하는 방식',
              content_urls: { desktop: { page: 'https://ko.wikipedia.org/wiki/단일_진실_공급원' } },
            });
          return new Response('', { status: 404 });
        }
        return Response.json({ query: { search: [] } });
      }
      if (url.hostname === 'en.wikipedia.org')
        return Response.json({ query: { pages: [{ ns: 0, title: 'SSOT' }] } });
      if (url.hostname === 'www.wikidata.org') {
        if (url.searchParams.get('action') === 'wbsearchentities')
          return Response.json({
            search: [
              { id: 'Q1', match: { type: 'alias', language: 'en', text: 'SSOT' } },
              { id: 'Q2', match: { type: 'label', language: 'en', text: 'SSOT' } },
              { id: 'Q3', match: { type: 'alias', language: 'en', text: 'SSOT-related' } },
            ],
          });
        return Response.json({
          entities: {
            Q1: {
              id: 'Q1',
              labels: {
                ko: { value: '단일 진실 공급원' },
                en: { value: 'single source of truth' },
              },
              descriptions: { en: { value: 'one authoritative source for each data element' } },
              sitelinks: { kowiki: { title: '단일 진실 공급원' } },
            },
            Q2: {
              id: 'Q2',
              labels: { en: { value: 'SSOT' } },
              descriptions: { en: { value: 'earth observation satellite' } },
            },
          },
        });
      }
      throw new Error(`unexpected request: ${input}`);
    });

    const response = await handler(new Request('https://worker.example/lookup?query=SSOT'));
    expect(await response.json()).toMatchObject({
      status: 'found',
      source: 'wikipedia',
      title: '단일 진실 공급원',
      extract: '정보를 한 곳에서만 제어하거나 편집하는 방식',
      isDisambiguation: false,
    });
  });

  it('returns basic English disambiguation candidates without fetching English context', async () => {
    const urls: string[] = [];
    const handler = createWorkerHandler(env, async (input) => {
      const url = new URL(input);
      urls.push(input);
      if (url.hostname.includes('naverapihub')) return Response.json({ items: [] });
      if (url.pathname.includes('/summary/')) {
        return Response.json({
          type: 'disambiguation',
          title: '트리거',
          extract: '여러 뜻',
          content_urls: { desktop: { page: 'https://ko.wikipedia.org/wiki/트리거' } },
        });
      }
      if (url.searchParams.get('action') === 'parse') return Response.json(parseResponse('트리거'));
      if (url.searchParams.get('generator') === 'links')
        return Response.json(linkedResponse('트리거'));
      throw new Error(`unexpected request: ${input}`);
    });

    const response = await handler(new Request('https://worker.example/lookup?query=Trigger'));
    expect((await response.json()).status).toBe('found');
    expect(urls.some((url) => url.includes('langlinks'))).toBe(false);
    expect(urls.some((url) => url.includes('en.wikipedia.org'))).toBe(false);
  });

  it('returns English extracts for requested Korean article titles', async () => {
    const urls: string[] = [];
    const handler = createWorkerHandler(env, async (input) => {
      const url = new URL(input);
      urls.push(input);
      if (url.hostname === 'ko.wikipedia.org') {
        return Response.json({
          query: {
            pages: [
              { ns: 0, title: '관리', langlinks: [{ lang: 'en', title: 'Management' }] },
              {
                ns: 0,
                title: '경영',
                langlinks: [{ lang: 'en', title: 'Business administration' }],
              },
            ],
          },
        });
      }
      if (url.hostname === 'en.wikipedia.org') {
        return Response.json({
          query: {
            pages: [
              { title: 'Management', extract: 'Management of applications and resources' },
              { title: 'Business administration', extract: 'Business leadership and strategy' },
            ],
          },
        });
      }
      throw new Error(`unexpected request: ${input}`);
    });
    const response = await handler(
      new Request('https://worker.example/english-context', {
        method: 'POST',
        body: JSON.stringify({ titles: ['관리', '경영'] }),
      }),
    );
    expect(await response.json()).toEqual({
      extracts: {
        관리: 'Management of applications and resources',
        경영: 'Business leadership and strategy',
      },
    });
    expect(urls).toHaveLength(2);
  });

  it('rejects more than eight English context titles before contacting Wikipedia', async () => {
    const handler = createWorkerHandler(env, async () => {
      throw new Error('unexpected external request');
    });
    const response = await handler(
      new Request('https://worker.example/english-context', {
        method: 'POST',
        body: JSON.stringify({ titles: Array.from({ length: 9 }, (_, index) => `title${index}`) }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it('uses Wikipedia when Naver reaches its call limit', async () => {
    const urls: string[] = [];
    const handler = createWorkerHandler(env, async (url) => {
      urls.push(url);
      if (url.includes('naverapihub.apigw.ntruss.com')) return new Response('{}', { status: 429 });
      return Response.json({
        type: 'standard',
        title: '온보딩',
        extract: '신입 직원의 적응',
        content_urls: { desktop: { page: 'https://ko.wikipedia.org/wiki/온보딩' } },
      });
    });
    const response = await handler(new Request('https://worker.example/lookup?query=온보딩'));
    expect(await response.json()).toMatchObject({
      status: 'found',
      source: 'wikipedia',
      title: '온보딩',
    });
    expect(urls).toHaveLength(2);
  });

  it('blocks a client after its Worker rate limit is reached', async () => {
    const handler = createWorkerHandler(
      { ...env, RATE_LIMITER: { limit: async () => ({ success: false }) } },
      async () => {
        throw new Error('should not reach API');
      },
    );
    const response = await handler(
      new Request('https://worker.example/lookup?query=온보딩', {
        headers: { 'CF-Connecting-IP': '127.0.0.1' },
      }),
    );
    expect(response.status).toBe(429);
  });
  it('rejects a query longer than 50 characters without contacting sources', async () => {
    const handler = createWorkerHandler(env, async () => {
      throw new Error('external request');
    });
    const response = await handler(
      new Request(`https://worker.example/lookup?query=${'가'.repeat(51)}`),
    );
    expect(response.status).toBe(400);
  });

  it('does not return credentials in error responses', async () => {
    const handler = createWorkerHandler(env, async () => {
      throw new Error('external request');
    });
    const response = await handler(new Request('https://worker.example/lookup?query=x'));
    expect(await response.text()).not.toContain('secret');
  });
});
