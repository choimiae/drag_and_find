import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface ApiPage {
  title?: string;
  extract?: string;
  missing?: string;
}

interface ApiResponse {
  query?: { pages?: Record<string, ApiPage> };
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
