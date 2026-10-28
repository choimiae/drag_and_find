import { stripTags, wikiTitleFromHref } from './html-text';
import type { Meaning } from './types';

const SEE_ALSO_SECTION = '같이 보기';
const BASIC_SECTION_MARK = '기본';
const HEADING = /^=+\s*(.+?)\s*=+$/u;

/** 뜻 모음 문서 본문 글자에서 기본 뜻 문장과 뜻 항목 줄을 꺼낸다. 첫 소개 문장과 '같이 보기' 이후는 버린다. */
export function parseDisambiguationText(text: string): { basic: string[]; lines: string[] } {
  const basic: string[] = [];
  const lines: string[] = [];
  let introSkipped = false;
  let basicTaken = false;
  let inBasic = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const heading = HEADING.exec(line)?.[1];
    if (heading !== undefined) {
      if (heading === SEE_ALSO_SECTION) break;
      inBasic = !basicTaken && heading.includes(BASIC_SECTION_MARK);
      basicTaken ||= inBasic;
      continue;
    }
    if (!introSkipped) {
      introSkipped = true;
      continue;
    }
    (inBasic ? basic : lines).push(line);
  }
  return { basic, lines };
}

/** 항목 줄마다 표시 글자와, 그 줄이 시작하는 가장 긴 연결 문서 제목을 짝짓는다. */
export function buildMeanings(lines: string[], linkedTitles: string[]): Meaning[] {
  return lines.map((line) => ({
    label: labelOf(line),
    title: longestPrefixTitle(line, linkedTitles),
  }));
}

function labelOf(line: string): string {
  const colon = line.indexOf(':');
  return colon > 0 ? line.slice(0, colon).trim() : line;
}

function longestPrefixTitle(line: string, titles: string[]): string | null {
  return (
    titles.filter((title) => line.startsWith(title)).sort((a, b) => b.length - a.length)[0] ?? null
  );
}

/** 뜻 모음 문서 HTML 해석에 쓰는 연결 문서 정보(`prop=links`의 한 항목). */
export interface ParsedLink {
  ns: number;
  title: string;
  exists: boolean;
}

const ARTICLE_NAMESPACE = 0;
const SCANNED_TAG = /<(\/?)(table|style|script|h[2-4]|ul|ol|li)(?=[\s>/])[^>]*>/giu;
const ANCHOR_HREF = /<a\s[^>]*?href="([^"]*)"/giu;
const SKIPPED_BLOCKS = new Set(['table', 'style', 'script']);
const LIST_TAGS = new Set(['ul', 'ol']);

/** 뜻 모음 문서 HTML에서 기본 뜻 글자와 뜻 항목(첫 문서 링크 포함)을 꺼낸다. 첫 소개 문단은 목록이 아니라 자연히 빠지고 '같이 보기' 이후는 버린다. */
export function parseDisambiguationHtml(
  html: string,
  links: readonly ParsedLink[],
): { basic: string[]; meanings: Meaning[] } {
  const linkByTitle = new Map(links.map((link) => [link.title, link]));
  const basic: string[] = [];
  const meanings: Meaning[] = [];
  let skipDepth = 0;
  let headingStart: number | null = null;
  let itemStart: number | null = null;
  let inBasic = false;
  let basicTaken = false;

  const closeItem = (itemEnd: number): void => {
    if (itemStart === null) return;
    const raw = html.slice(itemStart, itemEnd);
    itemStart = null;
    const text = stripTags(raw);
    if (!text) return;
    if (inBasic) basic.push(text);
    else meanings.push({ label: labelOf(text), title: firstArticleTarget(raw, linkByTitle) });
  };

  for (const match of html.matchAll(SCANNED_TAG)) {
    const isClosing = match[1] === '/';
    const name = (match[2] ?? '').toLowerCase();
    const start = match.index;
    const end = start + match[0].length;

    if (SKIPPED_BLOCKS.has(name)) {
      skipDepth = Math.max(0, skipDepth + (isClosing ? -1 : 1));
      continue;
    }
    if (skipDepth > 0) continue;

    if (name.startsWith('h')) {
      if (!isClosing) {
        closeItem(start);
        headingStart = end;
        continue;
      }
      if (headingStart === null) continue;
      const heading = stripTags(html.slice(headingStart, start));
      headingStart = null;
      if (heading === SEE_ALSO_SECTION) break;
      inBasic = !basicTaken && heading.includes(BASIC_SECTION_MARK);
      basicTaken ||= inBasic;
    } else if (name === 'li' && !isClosing) {
      closeItem(start);
      itemStart = end;
    } else if (name === 'li' || (LIST_TAGS.has(name) && !isClosing)) {
      // 안쪽 목록이 열리면 바깥 항목은 거기서 끝난다 — 안쪽 항목과 글자가 섞이지 않게 한다.
      closeItem(start);
    }
  }
  return { basic, meanings };
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
