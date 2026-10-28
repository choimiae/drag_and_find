import { stripTags, wikiTitleFromHref } from './html-text';
import type { Meaning } from './types';

const STOP_HEADINGS = new Set(['같이 보기', '각주', '출처', '참고 문헌', '외부 링크']);
const BASIC_SECTION_MARK = '기본';

function labelOf(line: string): string {
  const colon = line.indexOf(':');
  return colon > 0 ? line.slice(0, colon).trim() : line;
}

/** 뜻 모음 문서 HTML 해석에 쓰는 연결 문서 정보(`prop=links`의 한 항목). */
export interface ParsedLink {
  ns: number;
  title: string;
  exists: boolean;
}

const ARTICLE_NAMESPACE = 0;
const SCANNED_TAG = /<(\/?)(table|style|script|h[2-4]|ul|ol|li|div)(?=[\s>/])[^>]*>/giu;
const ANCHOR_HREF = /<a\s[^>]*?href="([^"]*)"/giu;
const REFERENCES_CLASS = /\bclass="(?:[^"]*\s)?(?:references|mw-references-wrap)(?:\s[^"]*)?"/iu;
const FOOTNOTE_MARKER =
  /<sup\b[^>]*\bclass="(?:[^"]*\s)?reference(?:\s[^"]*)?"[^>]*>[\s\S]*?<\/sup\s*>/giu;
const SKIPPED_BLOCKS = new Set(['table', 'style', 'script']);
const REFERENCES_BLOCKS = new Set(['ol', 'div']);
const LIST_TAGS = new Set(['ul', 'ol']);

/** 건너뛸 덩어리를 여는 태그인가: 표·스타일·스크립트, 또는 각주 목록(class에 references·mw-references-wrap이 있는 ol·div). */
function startsSkippedBlock(name: string, tag: string): boolean {
  return SKIPPED_BLOCKS.has(name) || (REFERENCES_BLOCKS.has(name) && REFERENCES_CLASS.test(tag));
}

/** 훑는 동안 바뀌는 상태 한 벌. */
interface ScanState {
  readonly html: string;
  readonly linkByTitle: Map<string, ParsedLink>;
  readonly basic: string[];
  readonly meanings: Meaning[];
  skipName: string;
  skipDepth: number;
  headingStart: number | null;
  itemStart: number | null;
  inBasic: boolean;
  basicTaken: boolean;
}

function closeItem(state: ScanState, itemEnd: number): void {
  if (state.itemStart === null) return;
  const raw = state.html.slice(state.itemStart, itemEnd).replace(FOOTNOTE_MARKER, '');
  state.itemStart = null;
  const text = stripTags(raw);
  if (!text) return;
  if (state.inBasic) state.basic.push(text);
  else
    state.meanings.push({
      label: labelOf(text),
      title: firstArticleTarget(raw, state.linkByTitle),
    });
}

/** 제목이 끝났을 때 호출한다. 끝 구역 제목이면 true(훑기 중단). */
function closeHeading(state: ScanState, headingEnd: number): boolean {
  if (state.headingStart === null) return false;
  const heading = stripTags(state.html.slice(state.headingStart, headingEnd));
  state.headingStart = null;
  if (STOP_HEADINGS.has(heading)) return true;
  state.inBasic = !state.basicTaken && heading.includes(BASIC_SECTION_MARK);
  state.basicTaken ||= state.inBasic;
  return false;
}

/** 태그 하나를 처리한다. 훑기를 멈춰야 하면 true. */
function handleTag(state: ScanState, match: RegExpMatchArray & { index: number }): boolean {
  const isClosing = match[1] === '/';
  const name = (match[2] ?? '').toLowerCase();
  const start = match.index;
  const end = start + match[0].length;

  if (state.skipDepth > 0) {
    if (name === state.skipName) state.skipDepth += isClosing ? -1 : 1;
    return false;
  }
  if (!isClosing && startsSkippedBlock(name, match[0])) {
    // 각주 목록은 옛 글자 방식에서도 보이지 않았고, 각주 안의 첫 링크는 뜻이 아니라 출처다.
    state.skipName = name;
    state.skipDepth = 1;
  } else if (name.startsWith('h')) {
    if (!isClosing) {
      closeItem(state, start);
      state.headingStart = end;
    } else return closeHeading(state, start);
  } else if (name === 'li' && !isClosing) {
    closeItem(state, start);
    state.itemStart = end;
  } else if (name === 'li' || (LIST_TAGS.has(name) && !isClosing)) {
    // 안쪽 목록이 열리면 바깥 항목은 거기서 끝난다 — 안쪽 항목과 글자가 섞이지 않게 한다.
    closeItem(state, start);
  }
  return false;
}

/** 뜻 모음 문서 HTML에서 기본 뜻 글자와 뜻 항목(첫 문서 링크 포함)을 꺼낸다. 첫 소개 문단은 목록이 아니라 자연히 빠지고 '같이 보기'·'각주' 등 끝 구역 이후는 버린다. */
export function parseDisambiguationHtml(
  html: string,
  links: readonly ParsedLink[],
): { basic: string[]; meanings: Meaning[] } {
  const state: ScanState = {
    html,
    linkByTitle: new Map(links.map((link) => [link.title, link])),
    basic: [],
    meanings: [],
    skipName: '',
    skipDepth: 0,
    headingStart: null,
    itemStart: null,
    inBasic: false,
    basicTaken: false,
  };
  for (const match of html.matchAll(SCANNED_TAG)) {
    if (handleTag(state, match)) break;
  }
  return { basic: state.basic, meanings: state.meanings };
}

function firstArticleTarget(rawItem: string, linkByTitle: Map<string, ParsedLink>): string | null {
  for (const match of rawItem.matchAll(ANCHOR_HREF)) {
    const title = wikiTitleFromHref(match[1] ?? '');
    const link = title === null ? undefined : linkByTitle.get(title);
    if (link === undefined || link.ns !== ARTICLE_NAMESPACE) continue;
    // 첫 문서 링크가 없는 문서면 뒤쪽 링크로 넘어가지 않는다 — 뒤쪽 링크는 항목 자체가 아니라 설명 속 단어일 수 있다.
    return link.exists ? link.title : null;
  }
  return null;
}
