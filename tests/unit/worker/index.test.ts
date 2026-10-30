import { describe, expect, it } from 'vitest';
import { createWorkerHandler } from '../../../worker/index';

const env = { NAVER_CLIENT_ID: 'id', NAVER_CLIENT_SECRET: 'secret' };

describe('createWorkerHandler', () => {
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
