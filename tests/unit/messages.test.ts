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
