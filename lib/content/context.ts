import { MAX_CONTEXT_LENGTH } from '../messages';

export const CONTEXT_RADIUS = 100;
const FALLBACK_LENGTH = 200;
const BLOCK_SELECTOR = 'p, li, td, dd, blockquote, h1, h2, h3, h4, h5, h6, article, section, div';

/** 블록 글자에서 선택 글자 앞뒤 100자를 문맥으로 잘라 낸다. 찾지 못하면 앞쪽 200자. */
export function extractContext(blockText: string, selectedText: string): string {
  const text = collapse(blockText);
  const target = collapse(selectedText);
  const index = target ? text.indexOf(target) : -1;
  if (index < 0) return Array.from(text).slice(0, FALLBACK_LENGTH).join('');
  const start = Math.max(0, index - CONTEXT_RADIUS);
  const end = index + target.length + CONTEXT_RADIUS;
  return Array.from(text.slice(start, end)).slice(0, MAX_CONTEXT_LENGTH).join('');
}

/** 선택이 들어 있는 가장 가까운 블록 요소의 글자. */
export function blockTextOf(node: Node | null): string {
  const element = node instanceof Element ? node : (node?.parentElement ?? null);
  return element?.closest(BLOCK_SELECTOR)?.textContent ?? '';
}

function collapse(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}
