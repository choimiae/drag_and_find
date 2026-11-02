import type { SenseCandidate } from './types';

export const MIN_OVERLAP = 3;
export const MIN_LEAD_RATIO = 1.5;

interface Scored {
  candidate: SenseCandidate;
  overlap: number;
  score: number;
}

/**
 * 문맥과 가장 많이 겹치는 뜻을 고른다. 확신할 때만 고르고, 애매하면 null.
 * 한국어는 조사가 붙어 낱말 단위 비교가 어려워 두 글자 조각으로 비교한다.
 */
export function pickSense(
  context: string,
  words: string[],
  candidates: SenseCandidate[],
): SenseCandidate | null {
  if (!context.trim() || candidates.length === 0) return null;
  const query = words[0] ?? '';

  // 영어 검색어일 때만 한국어 뜻 후보의 직접 언급을 확인한다.
  const isEnglishQuery = /[a-z]/i.test(query) && !/[가-힣]/u.test(query);

  if (isEnglishQuery) {
    const mentioned = pickMentionedKoreanSense(context, candidates);

    if (mentioned !== undefined) {
      return mentioned;
    }
    const englishResult = pickEnglishSense(context, words, candidates);

    if (englishResult !== undefined) {
      return englishResult;
    }
  }

  const contextPieces = twoLetterPieces(context, words);
  const [best, second] = candidates
    .map((candidate) => scoreCandidate(contextPieces, candidate, words))
    .sort((a, b) => b.score - a.score);
  if (!best || best.overlap < MIN_OVERLAP) return null;
  return best.score >= (second?.score ?? 0) * MIN_LEAD_RATIO ? best.candidate : null;
}

function scoreCandidate(
  contextPieces: Set<string>,
  candidate: SenseCandidate,
  words: string[],
): Scored {
  const pieces = twoLetterPieces(`${candidate.title} ${candidate.extract}`, words);
  const overlap = [...pieces].filter((piece) => contextPieces.has(piece)).length;
  return { candidate, overlap, score: pieces.size > 0 ? overlap / Math.sqrt(pieces.size) : 0 };
}

function twoLetterPieces(text: string, words: string[]): Set<string> {
  // 대소문자가 달라도 지워지도록 먼저 소문자로 바꾼 뒤 단어를 지운다.
  const withoutWords = words
    .map((word) => word.toLowerCase())
    .filter((word) => word !== '')
    .reduce((rest, word) => rest.split(word).join(' '), text.toLowerCase());
  const chars = Array.from(withoutWords.replace(/[^\p{L}\p{N}_]/gu, ''));
  return new Set(chars.slice(0, -1).map((char, index) => char + (chars[index + 1] ?? '')));
}

const ENGLISH_STOPWORDS = new Set([
  'about',
  'after',
  'also',
  'been',
  'being',
  'between',
  'could',
  'does',
  'from',
  'have',
  'into',
  'more',
  'most',
  'other',
  'over',
  'some',
  'such',
  'than',
  'that',
  'their',
  'them',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'were',
  'what',
  'when',
  'where',
  'which',
  'while',
  'with',
  'would',
  'your',
  'then',
  'very',
  'each',
  'will',
]);

function normalizeEnglishWord(word: string): string {
  let normalized = word.toLowerCase();

  // organizational → organization
  if (normalized.length > 10 && normalized.endsWith('al')) {
    normalized = normalized.slice(0, -2);
  }

  // companies → company
  if (normalized.length > 5 && normalized.endsWith('ies')) {
    return `${normalized.slice(0, -3)}y`;
  }

  // organizations → organization
  if (normalized.length > 4 && normalized.endsWith('s') && !normalized.endsWith('ss')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

function englishTokens(text: string, excluded: string[]): Set<string> {
  const ignored = new Set(
    excluded.flatMap((word) => (word.match(/[a-z]{3,}/gi) ?? []).map(normalizeEnglishWord)),
  );

  return new Set(
    (text.match(/[a-z]{3,}/gi) ?? [])
      .map(normalizeEnglishWord)
      .filter((word) => word.length >= 3 && !ENGLISH_STOPWORDS.has(word) && !ignored.has(word)),
  );
}

/**
 * 영어 문맥과 영어 위키백과 설명을 비교한다.
 * undefined: 영어 비교 대상 아님
 * null: 비교했지만 확신할 수 없음
 */
function pickEnglishSense(
  context: string,
  words: string[],
  candidates: SenseCandidate[],
): SenseCandidate | null | undefined {
  if (!isEnglishDominant(context)) {
    return undefined;
  }

  const contextTokens = englishTokens(context, words);

  const scored = candidates
    .map((candidate) => {
      const tokens = englishTokens(candidate.englishExtract ?? '', words);

      const overlap = [...contextTokens].filter((word) => tokens.has(word)).length;

      return {
        candidate,
        overlap,
        score: tokens.size ? overlap / Math.sqrt(tokens.size) : 0,
      };
    })
    .sort((a, b) => b.score - a.score);

  const [best, second] = scored;

  if (!best || best.overlap < 2) return null;

  if (second && (best.overlap <= second.overlap || best.score < second.score * MIN_LEAD_RATIO)) {
    return null;
  }

  return best.candidate;
}

function isEnglishDominant(context: string): boolean {
  const englishCount = (context.match(/[a-z]/gi) ?? []).length;
  const koreanCount = (context.match(/[가-힣]/gu) ?? []).length;
  return englishCount >= 10 && englishCount > koreanCount;
}

/** 영어 자료가 있으면 현재 브라우저 문맥 판단에 사용될 수 있는가. */
export function needsEnglishContext(
  context: string,
  words: string[],
  candidates: SenseCandidate[],
): boolean {
  return (
    isEnglishDominant(context) &&
    englishTokens(context, words).size >= 2 &&
    pickMentionedKoreanSense(context, candidates) === undefined
  );
}

/**
 * 주변 문장에 한국어 뜻 후보가 직접 언급되었는지 확인한다.
 *
 * - 한 후보만 언급되면 해당 후보 추천
 * - 여러 후보가 언급되면 판단 보류
 * - 아무 후보도 없으면 기존 알고리즘으로 진행
 */
function pickMentionedKoreanSense(
  context: string,
  candidates: SenseCandidate[],
): SenseCandidate | null | undefined {
  const mentioned = candidates.filter((candidate) => {
    const title = candidate.title.trim();

    // 두 글자 이상의 한글 제목만 비교
    if (/^[가-힣]{2,}$/u.test(title) && context.includes(title)) return true;

    return (candidate.aliases ?? []).some((alias) => {
      if (!/^[a-z][a-z\s-]{3,}$/iu.test(alias)) return false;
      const lowerContext = context.toLowerCase();
      const lowerAlias = alias.toLowerCase();
      const at = lowerContext.indexOf(lowerAlias);
      if (at < 0) return false;
      const before = lowerContext[at - 1] ?? '';
      const after = lowerContext[at + lowerAlias.length] ?? '';
      return !/[a-z]/u.test(before) && !/[a-z]/u.test(after);
    });
  });

  if (mentioned.length === 0) {
    return undefined;
  }

  if (mentioned.length > 1) {
    return null;
  }

  return mentioned[0];
}
