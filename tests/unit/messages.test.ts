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
