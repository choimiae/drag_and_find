import { describe, it, expect } from 'vitest';
import { contextAroundRange, joinContext } from '../../../lib/content/context';
import { MAX_CONTEXT_LENGTH } from '../../../lib/messages';

describe('joinContext', () => {
  it('keeps up to 100 characters before and after the selection', () => {
    expect(joinContext('가'.repeat(150), '트리거', '나'.repeat(150))).toBe(
      `${'가'.repeat(100)}트리거${'나'.repeat(100)}`,
    );
  });

  it('keeps short parts whole', () => {
    expect(joinContext('주문 테이블에 ', '트리거', '를 걸었다.')).toBe(
      '주문 테이블에 트리거를 걸었다.',
    );
  });

  it('collapses line breaks and repeated spaces and trims the outer ends', () => {
    expect(joinContext('\n주문\n\n테이블에   ', '트리거', ' 를\n걸었다. \n')).toBe(
      '주문 테이블에 트리거 를 걸었다.',
    );
  });

  it('cuts the whole result to the request limit', () => {
    const result = joinContext('앞'.repeat(200), '가'.repeat(60), '뒤'.repeat(200));

    expect(Array.from(result)).toHaveLength(MAX_CONTEXT_LENGTH);
    expect(MAX_CONTEXT_LENGTH).toBe(250);
  });
});

function selectRange(id: string): Range {
  const range = document.createRange();
  range.selectNodeContents(document.getElementById(id)!);
  return range;
}

describe('contextAroundRange', () => {
  it('builds the context around the selected occurrence of a repeated word', () => {
    document.body.innerHTML =
      '<p>트리거 앞부분 이야기가 먼저 나온다. 그리고 <span id="second">트리거</span> 뒷부분 이야기다.</p>';

    expect(contextAroundRange(selectRange('second'))).toBe(
      '트리거 앞부분 이야기가 먼저 나온다. 그리고 트리거 뒷부분 이야기다.',
    );
  });

  it('does not start from the first occurrence when the block is long', () => {
    const far = '멀리 있는 첫 트리거 이야기. '.repeat(20);
    document.body.innerHTML = `<p>${far}<span id="second">트리거</span> 끝</p>`;

    const result = contextAroundRange(selectRange('second'));

    expect(result.endsWith('트리거 끝')).toBe(true);
    expect(Array.from(result).length).toBeLessThanOrEqual(MAX_CONTEXT_LENGTH);
    expect(result.startsWith(far.slice(0, 20))).toBe(false);
  });

  it('keeps only the last 100 characters before a span inside a large wrapper div', () => {
    const unrelated = '무'.repeat(300);
    const near = '가'.repeat(100);
    document.body.innerHTML = `<div>${unrelated}${near}<span id="w">단어</span></div>`;

    expect(contextAroundRange(selectRange('w'))).toBe(`${near}단어`);
  });

  it('returns only the selected text when there is no block ancestor', () => {
    document.body.innerHTML = '바깥 글자 <b id="w">단어</b> 바깥 글자';

    expect(contextAroundRange(selectRange('w'))).toBe('단어');
  });
});
