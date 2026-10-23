import { describe, it, expect } from 'vitest';
import { googleSearchUrl, naverSearchUrl } from '../../lib/search-urls';

describe('search urls', () => {
  it('builds a Google search url with the encoded query', () => {
    expect(googleSearchUrl('온보딩')).toBe(
      'https://www.google.com/search?q=%EC%98%A8%EB%B3%B4%EB%94%A9',
    );
  });

  it('builds a Naver search url with the encoded query', () => {
    expect(naverSearchUrl('온보딩')).toBe(
      'https://search.naver.com/search.naver?query=%EC%98%A8%EB%B3%B4%EB%94%A9',
    );
  });

  it('encodes characters that would break the url', () => {
    expect(naverSearchUrl('A&B #1?')).toBe(
      'https://search.naver.com/search.naver?query=A%26B%20%231%3F',
    );
    expect(googleSearchUrl('TCP/IP')).toBe('https://www.google.com/search?q=TCP%2FIP');
  });
});
