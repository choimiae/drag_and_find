import { describe, it, expect } from 'vitest';
import { isLookupRequest, isLookupResult, isTriggerRequest } from '../../lib/messages';

describe('isLookupRequest', () => {
  it('accepts a lookup message with a string query', () => {
    expect(isLookupRequest({ type: 'lookup', query: '온보딩' })).toBe(true);
  });

  it.each([null, 'lookup', { type: 'lookup' }, { type: 'lookup', query: 3 }, { query: 'x' }])(
    'rejects %j',
    (message) => {
      expect(isLookupRequest(message)).toBe(false);
    },
  );
});

describe('isTriggerRequest', () => {
  it('accepts only the trigger message', () => {
    expect(isTriggerRequest({ type: 'trigger-from-shortcut' })).toBe(true);
    expect(isTriggerRequest({ type: 'lookup', query: 'x' })).toBe(false);
    expect(isTriggerRequest(undefined)).toBe(false);
  });
});

describe('isLookupResult', () => {
  it('accepts a Wikidata result with a Korean description', () => {
    expect(
      isLookupResult({
        status: 'found',
        source: 'wikidata',
        title: '모노리포',
        extract: '여러 프로젝트를 하나의 저장소에서 관리하는 방식',
        url: 'https://www.wikidata.org/wiki/Q1',
        isDisambiguation: false,
      }),
    ).toBe(true);
  });
  it('rejects an unknown found-result source', () => {
    expect(
      isLookupResult({
        status: 'found',
        title: 'x',
        extract: 'x',
        url: 'https://example.com',
        isDisambiguation: false,
        source: 'evil',
      }),
    ).toBe(false);
  });
  it('accepts a complete found result', () => {
    expect(
      isLookupResult({
        status: 'found',
        title: '온보딩',
        extract: '설명',
        url: 'https://ko.wikipedia.org/wiki/x',
        isDisambiguation: false,
      }),
    ).toBe(true);
  });

  it.each(['not_found', 'rate_limited', 'network_error'])('accepts %s', (status) => {
    expect(isLookupResult({ status })).toBe(true);
  });

  it.each([undefined, { status: 'found', title: '온보딩' }, { status: 'unknown' }, 'found'])(
    'rejects %j',
    (value) => {
      expect(isLookupResult(value)).toBe(false);
    },
  );
});

describe('isLookupRequest with context', () => {
  it('accepts a string context', () => {
    expect(isLookupRequest({ type: 'lookup', query: '트리거', context: '문맥' })).toBe(true);
  });

  it('rejects a non-string context', () => {
    expect(isLookupRequest({ type: 'lookup', query: '트리거', context: 3 })).toBe(false);
  });
});

describe('isLookupResult with disambiguation', () => {
  const base = {
    status: 'found',
    title: '트리거',
    extract: '',
    url: 'https://ko.wikipedia.org/wiki/x',
    isDisambiguation: true,
  };
  const candidate = {
    title: '방아쇠',
    extract: '총의 격발 장치',
    url: 'https://ko.wikipedia.org/wiki/y',
  };

  it('accepts complete disambiguation info and suggestion', () => {
    expect(
      isLookupResult({
        ...base,
        disambiguation: {
          basic: ['총의 방아쇠'],
          meanings: [
            { label: '방아쇠', title: '방아쇠' },
            { label: '트리거 전략', title: null },
          ],
          candidates: [candidate],
        },
        suggestion: candidate,
      }),
    ).toBe(true);
  });

  it.each([
    { disambiguation: { basic: 'x', meanings: [], candidates: [] } },
    { disambiguation: { basic: [], meanings: [{ label: 3, title: null }], candidates: [] } },
    { disambiguation: { basic: [], meanings: [{ label: 'a', title: 1 }], candidates: [] } },
    { disambiguation: { basic: [], meanings: [], candidates: [{ title: 'a' }] } },
    { suggestion: { title: 'a', extract: 'b' } },
  ])('rejects malformed %j', (extra) => {
    expect(isLookupResult({ ...base, ...extra })).toBe(false);
  });
});

describe('isLookupResult with source alternatives', () => {
  const found = {
    status: 'found',
    source: 'wikipedia',
    title: 'RAG',
    extract: '여러 뜻',
    url: 'https://ko.wikipedia.org/wiki/RAG',
    isDisambiguation: true,
  };

  it('accepts valid source alternatives', () => {
    expect(
      isLookupResult({
        ...found,
        alternatives: [
          {
            source: 'naver',
            title: 'RAG',
            extract: '독일 에너지 기업',
            url: 'https://terms.naver.com/entry.naver?docId=1',
            isDisambiguation: false,
          },
        ],
      }),
    ).toBe(true);
  });

  it('rejects malformed source alternatives', () => {
    expect(isLookupResult({ ...found, alternatives: [{ source: 'unknown' }] })).toBe(false);
    expect(isLookupResult({ ...found, alternatives: 'invalid' })).toBe(false);
  });
});

describe('isLookupResult with alternatives', () => {
  const found = {
    status: 'found',
    source: 'naver',
    title: 'RAG',
    extract: '네이버 백과 설명',
    url: 'https://terms.naver.com/entry.naver?docId=1',
    isDisambiguation: false,
  };

  it('다른 출처의 검색 결과를 허용한다', () => {
    expect(
      isLookupResult({
        ...found,
        alternatives: [
          {
            source: 'wikipedia',
            title: 'RAG',
            extract: '여러 뜻을 가진 단어',
            url: 'https://ko.wikipedia.org/wiki/RAG',
            isDisambiguation: true,
            disambiguation: {
              basic: [],
              meanings: [
                {
                  label: '검색증강생성',
                  title: '검색증강생성',
                },
              ],
              candidates: [],
            },
          },
        ],
      }),
    ).toBe(true);
  });

  it('다른 출처 정보가 없어도 기존 응답을 허용한다', () => {
    expect(isLookupResult(found)).toBe(true);
  });

  it('잘못된 출처 정보는 거부한다', () => {
    expect(
      isLookupResult({
        ...found,
        alternatives: [
          {
            source: 'unknown',
            title: 'RAG',
            extract: '설명',
            url: 'https://example.test',
            isDisambiguation: false,
          },
        ],
      }),
    ).toBe(false);

    expect(
      isLookupResult({
        ...found,
        alternatives: 'invalid',
      }),
    ).toBe(false);
  });
});
