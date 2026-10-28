const WIKI_PATH_PREFIX = '/wiki/';
const WIKI_ORIGIN = 'https://ko.wikipedia.org';
const REDLINK_MARK = 'redlink=1';
const MAX_CODE_POINT = 0x10ffff;
const NAMED_ENTITIES = new Map<string, string>([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
  ['nbsp', ' '],
]);
const ENTITY = /&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/giu;
const STYLE_OR_SCRIPT_BLOCK = /<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/giu;
const TAG = /<[^>]*>/gu;
const WHITESPACE_RUN = /\s+/gu;

/** 자주 쓰는 HTML 엔티티(이름·10진·16진)를 글자로 바꾼다. 모르는 엔티티와 범위 밖 숫자는 그대로 둔다. */
export function decodeEntities(text: string): string {
  return text.replace(ENTITY, (whole, decimal?: string, hex?: string, name?: string) => {
    if (name !== undefined) return NAMED_ENTITIES.get(name.toLowerCase()) ?? whole;
    const codePoint = decimal !== undefined ? Number(decimal) : parseInt(hex ?? '', 16);
    return codePoint <= MAX_CODE_POINT ? String.fromCodePoint(codePoint) : whole;
  });
}

/** HTML에서 태그를 벗기고(style·script는 안쪽까지 버림) 엔티티를 풀어 공백을 하나로 합친 글자를 돌려준다. */
export function stripTags(html: string): string {
  const withoutTags = html.replace(STYLE_OR_SCRIPT_BLOCK, '').replace(TAG, '');
  return decodeEntities(withoutTags).replace(WHITESPACE_RUN, ' ').trim();
}

/** 위키백과 링크 주소에서 문서 제목을 꺼낸다. 위키백과 문서 링크나 빨간 링크가 아니면 null이다. */
export function wikiTitleFromHref(href: string): string | null {
  const decoded = decodeEntities(href);
  if (decoded.startsWith(WIKI_PATH_PREFIX)) {
    const path = decoded.slice(WIKI_PATH_PREFIX.length).split('#')[0] ?? '';
    return titleOrNull(safeDecodeURIComponent(path));
  }
  if (decoded.includes(REDLINK_MARK)) {
    return titleOrNull(safeTitleParam(decoded));
  }
  return null;
}

function safeTitleParam(href: string): string | null {
  try {
    return new URL(href, WIKI_ORIGIN).searchParams.get('title');
  } catch {
    return null;
  }
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function titleOrNull(raw: string | null): string | null {
  const title = raw?.replaceAll('_', ' ') ?? '';
  return title === '' ? null : title;
}
