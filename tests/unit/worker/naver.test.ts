import { describe, expect, it, vi } from 'vitest';
import { createNaverProvider } from '../../../worker/naver';

const credentials = { clientId: 'id', clientSecret: 'secret' };

describe('createNaverProvider', () => {
  it('logs an authentication error status without exposing credentials', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const result = await createNaverProvider(
        credentials,
        async () => new Response('{}', { status: 401 }),
      ).lookup('온보딩');

      expect(result).toEqual({ status: 'network_error' });
      expect(error).toHaveBeenCalledWith('네이버 API 인증 또는 권한 오류', 401);
    } finally {
      error.mockRestore();
    }
  });

  it('reports a server failure for Wikipedia fallback', async () => {
    const result = await createNaverProvider(
      credentials,
      async () => new Response('{}', { status: 503 }),
    ).lookup('온보딩');

    expect(result).toEqual({ status: 'network_error' });
  });

  it('requests one encyclopedia result with server credentials and returns its original link', async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({
        total: 1,
        start: 1,
        display: 1,
        items: [
          {
            title: '<b>온보딩</b>',
            link: 'https://terms.naver.com/entry.naver?docId=1',
            description: '신입 <b>직원</b>의 적응',
          },
        ],
      }),
    );

    const result = await createNaverProvider(credentials, fetchFn).lookup('온보딩');

    expect(result).toEqual({
      status: 'found',
      source: 'naver',
      title: '온보딩',
      extract: '신입 직원의 적응',
      url: 'https://terms.naver.com/entry.naver?docId=1',
      isDisambiguation: false,
    });

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];

    expect(new URL(url).searchParams.get('display')).toBe('1');
    expect(new URL(url).searchParams.get('query')).toBe('온보딩');
    expect(init.headers).toEqual({
      'X-NCP-APIGW-API-KEY-ID': 'id',
      'X-NCP-APIGW-API-KEY': 'secret',
    });
  });

  it('reports an empty result so Wikipedia can be queried', async () => {
    const result = await createNaverProvider(credentials, async () =>
      Response.json({
        total: 0,
        start: 1,
        display: 0,
        items: [],
      }),
    ).lookup('없는말');

    expect(result).toEqual({ status: 'not_found' });
  });

  it('reports a 429 as rate_limited', async () => {
    const result = await createNaverProvider(
      credentials,
      async () => new Response('{}', { status: 429 }),
    ).lookup('온보딩');

    expect(result).toEqual({ status: 'rate_limited' });
  });

  // 추가: 검색어와 다른 제목의 결과를 제외하는지 검증
  it('검색어와 무관한 제목은 결과로 사용하지 않는다', async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({
        items: [
          {
            title: '물사용량',
            description: '세탁 과정에서 사용되는 물의 양',
            link: 'https://terms.naver.com/entry.naver?docId=1',
          },
        ],
      }),
    );

    const result = await createNaverProvider(credentials, fetchFn).lookup('사용량');

    expect(result).toEqual({ status: 'not_found' });
  });
});
