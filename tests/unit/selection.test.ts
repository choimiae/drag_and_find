import { describe, it, expect, beforeEach } from 'vitest';
import {
  MAX_QUERY_LENGTH,
  checkSelection,
  isInEditableContext,
  normalizeQuery,
} from '../../lib/selection';

describe('normalizeQuery', () => {
  it('collapses line breaks and repeated spaces into one space', () => {
    expect(normalizeQuery('  온보딩\n   과정  ')).toBe('온보딩 과정');
  });

  it('strips quotes, brackets and punctuation at both ends', () => {
    expect(normalizeQuery('"온보딩",')).toBe('온보딩');
    expect(normalizeQuery('(SaaS).')).toBe('SaaS');
    expect(normalizeQuery('「퍼널」')).toBe('퍼널');
    expect(normalizeQuery('…레버리지!?')).toBe('레버리지');
  });

  it('keeps symbols that belong to the term', () => {
    expect(normalizeQuery('C++')).toBe('C++');
    expect(normalizeQuery('TCP/IP')).toBe('TCP/IP');
  });
});

describe('checkSelection', () => {
  it('reports empty for blank or punctuation-only text', () => {
    expect(checkSelection('')).toEqual({ kind: 'empty' });
    expect(checkSelection('   ')).toEqual({ kind: 'empty' });
    expect(checkSelection('".,"')).toEqual({ kind: 'empty' });
  });

  it('accepts a single character', () => {
    expect(checkSelection('온')).toEqual({ kind: 'ok', query: '온' });
  });

  it('accepts exactly the maximum length', () => {
    const text = '가'.repeat(MAX_QUERY_LENGTH);
    expect(checkSelection(text)).toEqual({ kind: 'ok', query: text });
  });

  it('rejects one character over the maximum', () => {
    expect(checkSelection('가'.repeat(MAX_QUERY_LENGTH + 1))).toEqual({
      kind: 'too_long',
      length: MAX_QUERY_LENGTH + 1,
    });
  });

  it('counts emoji as one character each', () => {
    const text = '😀'.repeat(MAX_QUERY_LENGTH);
    expect(checkSelection(text)).toEqual({ kind: 'ok', query: text });
  });

  it('returns the normalized query', () => {
    expect(checkSelection(' "온보딩", ')).toEqual({ kind: 'ok', query: '온보딩' });
  });
});

describe('isInEditableContext', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <p id="plain">글</p>
      <textarea id="area">메모</textarea>
      <div contenteditable="true"><span id="editable">편집</span></div>
      <div contenteditable="false"><span id="locked">고정</span></div>`;
  });

  const textOf = (id: string) => document.getElementById(id)!.firstChild;

  it('is false for normal page text', () => {
    expect(isInEditableContext(textOf('plain'), document.body)).toBe(false);
  });

  it('is true while a textarea or input has focus', () => {
    expect(isInEditableContext(textOf('plain'), document.getElementById('area'))).toBe(true);
  });

  it('is true inside contenteditable', () => {
    expect(isInEditableContext(textOf('editable'), document.body)).toBe(true);
  });

  it('is false inside contenteditable="false"', () => {
    expect(isInEditableContext(textOf('locked'), document.body)).toBe(false);
  });

  it('is false when there is no node', () => {
    expect(isInEditableContext(null, null)).toBe(false);
  });
});
