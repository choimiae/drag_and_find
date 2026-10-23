/** 검색어로 허용하는 최대 글자 수. */
export const MAX_QUERY_LENGTH = 50;

const EDGE_CHARACTERS = `\\s"'“”‘’「」『』()\\[\\]{}<>.,!?;:·…~\\-`;
const EDGE_PATTERN = new RegExp(`^[${EDGE_CHARACTERS}]+|[${EDGE_CHARACTERS}]+$`, 'gu');
const EDITABLE_SELECTOR = 'input, textarea, [contenteditable]:not([contenteditable="false"])';

export type SelectionCheck =
  { kind: 'ok'; query: string } | { kind: 'empty' } | { kind: 'too_long'; length: number };

/** 줄바꿈·연속 공백을 합치고 양끝 따옴표·괄호·문장부호를 걷어 낸다. */
export function normalizeQuery(raw: string): string {
  return raw.replace(/\s+/gu, ' ').replace(EDGE_PATTERN, '');
}

/** 선택 문자열을 정리하고 검색 가능한 길이인지 판정한다. */
export function checkSelection(raw: string): SelectionCheck {
  const query = normalizeQuery(raw);
  const length = Array.from(query).length;
  if (length === 0) return { kind: 'empty' };
  if (length > MAX_QUERY_LENGTH) return { kind: 'too_long', length };
  return { kind: 'ok', query };
}

/** 선택이 입력칸·편집 영역 안에서 일어났는지 판정한다. */
export function isInEditableContext(
  anchorNode: Node | null,
  activeElement: Element | null,
): boolean {
  if (activeElement?.matches('input, textarea')) return true;
  const element = anchorNode instanceof Element ? anchorNode : (anchorNode?.parentElement ?? null);
  return element?.closest(EDITABLE_SELECTOR) != null;
}
