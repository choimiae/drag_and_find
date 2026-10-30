import { describe, expect, it, vi } from 'vitest';
import { createWorkerProvider } from '../../../lib/lookup/worker-client';

describe('createWorkerProvider', () => {
  it('waits for a slow Wikipedia fallback after the Naver request times out', async () => {
    const found = {
      status: 'found',
      source: 'wikipedia',
      title: '온보딩',
      extract: '설명',
      url: 'https://ko.wikipedia.org/wiki/온보딩',
      isDisambiguation: false,
    };
    const fetchFn = (_url: string, init?: RequestInit): Promise<Response> =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(Response.json(found)), 8100);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('aborted'));
        });
      });
    expect(
      await createWorkerProvider('https://lookup.example.test', fetchFn).lookup('온보딩'),
    ).toEqual(found);
  }, 12000);
  it('sends only the query to the configured Worker and accepts a found result', async () => {
    const found = {
      status: 'found',
      source: 'naver',
      title: '온보딩',
      extract: '설명',
      url: 'https://terms.naver.com/x',
      isDisambiguation: false,
    };
    const fetchFn = vi.fn(async () => Response.json(found));
    expect(
      await createWorkerProvider('https://lookup.example.test', fetchFn).lookup('온보딩'),
    ).toEqual(found);
    const [url] = fetchFn.mock.calls[0] as unknown as [string];
    expect(url).toBe('https://lookup.example.test/lookup?query=%EC%98%A8%EB%B3%B4%EB%94%A9');
    expect(url).not.toContain('context');
  });

  it('turns malformed Worker responses into network_error', async () => {
    expect(
      await createWorkerProvider('https://lookup.example.test', async () =>
        Response.json({ status: 'found', source: 'oops' }),
      ).lookup('x'),
    ).toEqual({ status: 'network_error' });
  });
});
