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
