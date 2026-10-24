import { describe, it, expect } from 'vitest';
import { blockTextOf, extractContext } from '../../../lib/content/context';
import { MAX_CONTEXT_LENGTH } from '../../../lib/messages';

describe('extractContext', () => {
  it('takes up to 100 characters before and after the selection', () => {
    const block = `${'가'.repeat(150)}트리거${'나'.repeat(150)}`;

    expect(extractContext(block, '트리거')).toBe(`${'가'.repeat(100)}트리거${'나'.repeat(100)}`);
  });

  it('keeps short blocks whole', () => {
    expect(extractContext('주문 테이블에 트리거를 걸었다.', '트리거')).toBe(
      '주문 테이블에 트리거를 걸었다.',
    );
  });

  it('collapses line breaks and repeated spaces', () => {
    expect(extractContext('주문\n\n테이블에   트리거', '트리거')).toBe('주문 테이블에 트리거');
  });

  it('falls back to the first 200 characters when the selection is not found', () => {
    expect(extractContext('다'.repeat(300), '트리거')).toBe('다'.repeat(200));
  });

  it('never exceeds the request limit even for a fifty-character selection', () => {
    const selected = '가'.repeat(50);
    const block = `${'앞'.repeat(300)}${selected}${'뒤'.repeat(300)}`;

    expect(Array.from(extractContext(block, selected)).length).toBeLessThanOrEqual(
      MAX_CONTEXT_LENGTH,
    );
  });
});

describe('blockTextOf', () => {
  it('uses the closest block element', () => {
    document.body.innerHTML = '<div>바깥 <p id="p">요즘 <span id="w">트리거</span> 기능</p></div>';

    expect(blockTextOf(document.getElementById('w')?.firstChild ?? null)).toBe('요즘 트리거 기능');
  });

  it('returns an empty string without a node', () => {
    expect(blockTextOf(null)).toBe('');
  });
});
