import { MAX_CONTEXT_LENGTH } from '../messages';

export const CONTEXT_RADIUS = 100;
const BLOCK_SELECTOR = 'p, li, td, dd, blockquote, h1, h2, h3, h4, h5, h6, article, section, div';

/** 선택 글자 앞 100자·뒤 100자를 이어 붙여 문맥으로 만든다. 전체는 요청 한도로 자른다. */
export function joinContext(before: string, selected: string, after: string): string {
  const head = Array.from(collapse(before)).slice(-CONTEXT_RADIUS).join('');
  const tail = Array.from(collapse(after)).slice(0, CONTEXT_RADIUS).join('');
  const joined = collapse(`${head}${collapse(selected)}${tail}`).trim();
  return Array.from(joined).slice(0, MAX_CONTEXT_LENGTH).join('');
}

/** 선택 범위의 실제 위치를 기준으로, 가장 가까운 블록 요소 안의 앞뒤 글자를 문맥으로 읽는다. */
export function contextAroundRange(range: Range): string {
  const selected = range.toString();
  const startElement =
    range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement;
  const block = startElement?.closest(BLOCK_SELECTOR) ?? null;
  if (!block) return joinContext('', selected, '');

  const beforeRange = document.createRange();
  beforeRange.setStart(block, 0);
  beforeRange.setEnd(range.startContainer, range.startOffset);
  const afterRange = document.createRange();
  afterRange.setStart(range.endContainer, range.endOffset);
  afterRange.setEnd(block, block.childNodes.length);
  return joinContext(beforeRange.toString(), selected, afterRange.toString());
}

function collapse(text: string): string {
  return text.replace(/\s+/gu, ' ');
}
