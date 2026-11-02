import { MAX_CONTEXT_LENGTH } from '../messages';

export const CONTEXT_RADIUS = 100;
const RAW_SLICE_LENGTH = 400;
const BLOCK_SELECTOR = 'p, li, td, dd, blockquote, h1, h2, h3, h4, h5, h6, article, section, div';

/** 선택 글자 앞 100자·뒤 100자를 이어 붙여 문맥으로 만든다. 전체는 요청 한도로 자른다. */
export function joinContext(before: string, selected: string, after: string): string {
  // 아주 큰 블록(페이지 전체 글 등)을 통째로 처리하지 않도록, 공백 정리 전에 앞뒤 일부만 먼저 자른다.
  const head = Array.from(collapse(before.slice(-RAW_SLICE_LENGTH)))
    .slice(-CONTEXT_RADIUS)
    .join('');
  const tail = Array.from(collapse(after.slice(0, RAW_SLICE_LENGTH)))
    .slice(0, CONTEXT_RADIUS)
    .join('');
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

  // 제목 안에서 선택했다면 제목 전체를 문맥의 기준으로 삼는다.
  const heading = startElement?.closest('h1, h2, h3, h4, h5, h6');

  const block = heading ?? startElement?.closest(BLOCK_SELECTOR) ?? null;

  if (!block) {
    return joinContext('', selected, '');
  }

  const beforeRange = document.createRange();
  beforeRange.setStart(block, 0);
  beforeRange.setEnd(range.startContainer, range.startOffset);

  const afterRange = document.createRange();
  afterRange.setStart(range.endContainer, range.endOffset);
  afterRange.setEnd(block, block.childNodes.length);

  const before = beforeRange.toString();
  const after = afterRange.toString();

  // 제목 바로 아래에 짧은 설명이 있으면 추가한다.
  const description = heading ? nearbyHeadingDescription(heading) : '';

  const afterWithDescription = description ? `${after} ${description}` : after;

  return joinContext(before, selected, afterWithDescription);
}

function collapse(text: string): string {
  return text.replace(/\s+/gu, ' ');
}

/**
 * 제목 근처의 짧은 설명을 찾는다.
 * 페이지 전체나 메뉴까지 가져오지 않도록
 * 바로 다음 형제 요소만 제한적으로 확인한다.
 */
function nearbyHeadingDescription(heading: Element): string {
  const parent = heading.parentElement;

  const candidates: Array<Element | null> = [heading.nextElementSibling];

  // 제목이 별도 div로 감싸진 경우도 처리
  if (parent?.childElementCount === 1) {
    candidates.push(parent.nextElementSibling);
  }

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (!candidate.matches('p, div, span, small')) {
      continue;
    }

    if (
      candidate.closest('nav, aside, [role="navigation"]') ||
      candidate.matches('[hidden], [aria-hidden="true"]')
    ) {
      continue;
    }

    // 메뉴, 버튼, 입력 영역이나 복잡한 콘텐츠는 제외
    if (
      candidate.querySelector(
        'nav, aside, button, input, select, textarea, ' + 'table, ul, ol, h1, h2, h3, h4, h5, h6',
      )
    ) {
      continue;
    }

    const text = collapse(candidate.textContent ?? '').trim();

    if (text.length >= 8 && text.length <= 200) {
      return text;
    }
  }

  return '';
}
