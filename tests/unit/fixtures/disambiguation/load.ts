import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ParsedLink } from '../../../../lib/lookup/disambiguation';

interface ApiPage {
  title?: string;
  extract?: string;
  missing?: string;
}

interface ApiResponse {
  query?: { pages?: Record<string, ApiPage> };
}

interface ParseApiResponse {
  parse?: { text?: unknown; links?: unknown };
}

const DIR = resolve(process.cwd(), 'tests/unit/fixtures/disambiguation');

function read(kind: 'pages' | 'linked', word: string): ApiResponse {
  return JSON.parse(readFileSync(resolve(DIR, kind, `${word}.json`), 'utf8')) as ApiResponse;
}

/** 뜻 모음 문서 본문 글자 응답 원본. */
export function pageTextResponse(word: string): ApiResponse {
  return read('pages', word);
}

/** 연결 문서 첫 문단 응답 원본. */
export function linkedResponse(word: string): ApiResponse {
  return read('linked', word);
}

/** 뜻 모음 문서 본문 글자. */
export function pageText(word: string): string {
  return Object.values(read('pages', word).query?.pages ?? {})[0]?.extract ?? '';
}

/** 첫 문단이 있는 연결 문서들. */
export function linkedPages(word: string): Array<{ title: string; extract: string }> {
  return Object.values(read('linked', word).query?.pages ?? {}).flatMap((page) =>
    page.title && page.extract ? [{ title: page.title, extract: page.extract }] : [],
  );
}

/** 뜻 모음 문서 HTML 응답 원본. */
export function parseResponse(word: string): ParseApiResponse {
  return JSON.parse(
    readFileSync(resolve(DIR, 'parse', `${word}.json`), 'utf8'),
  ) as ParseApiResponse;
}

/** 뜻 모음 문서 본문 HTML. */
export function parseHtml(word: string): string {
  const text = parseResponse(word).parse?.text;
  return typeof text === 'string' ? text : '';
}

/** 뜻 모음 문서의 연결 목록 중 형식이 맞는 항목만. */
export function parseLinks(word: string): ParsedLink[] {
  const links = parseResponse(word).parse?.links;
  if (!Array.isArray(links)) return [];
  return links.flatMap((link: unknown) => {
    const { ns, title, exists } = (link ?? {}) as Record<string, unknown>;
    return typeof ns === 'number' && typeof title === 'string' && typeof exists === 'boolean'
      ? [{ ns, title, exists }]
      : [];
  });
}
