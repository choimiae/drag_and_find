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
  word: string,
  candidates: SenseCandidate[],
): SenseCandidate | null {
  if (!context.trim() || candidates.length === 0) return null;
  const contextPieces = twoLetterPieces(context, word);
  const [best, second] = candidates
    .map((candidate) => scoreCandidate(contextPieces, candidate, word))
    .sort((a, b) => b.score - a.score);
  if (!best || best.overlap < MIN_OVERLAP) return null;
  return best.score >= (second?.score ?? 0) * MIN_LEAD_RATIO ? best.candidate : null;
}

function scoreCandidate(
  contextPieces: Set<string>,
  candidate: SenseCandidate,
  word: string,
): Scored {
  const pieces = twoLetterPieces(`${candidate.title} ${candidate.extract}`, word);
  const overlap = [...pieces].filter((piece) => contextPieces.has(piece)).length;
  return { candidate, overlap, score: pieces.size > 0 ? overlap / Math.sqrt(pieces.size) : 0 };
}

function twoLetterPieces(text: string, word: string): Set<string> {
  const cleaned = text
    .split(word)
    .join(' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]/gu, '');
  const chars = Array.from(cleaned);
  return new Set(chars.slice(0, -1).map((char, index) => char + (chars[index + 1] ?? '')));
}
