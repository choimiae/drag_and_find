import { pickSense } from './sense';
import type { SenseCandidate } from './types';

export function pickNaverSense(
  context: string,
  words: string[],
  candidates: SenseCandidate[],
): SenseCandidate | null {
  const result = pickSense(context, words, candidates);

  if (result) return result;

  return pickByKeywords(context, words, candidates);
}

/**
 * 기존 두 글자 비교로 판단하지 못했을 때
 * 문맥과 후보 설명의 공통 단어를 비교한다.
 *
 * 실험용 보조 판단 로직.
 */

function pickByKeywords(
  context: string,
  words: string[],
  candidates: SenseCandidate[],
): SenseCandidate | null {
  const contextWeights = getContextTokenWeights(context, words);

  if (contextWeights.size < 3) return null;

  const ranked = candidates
    .map((candidate) => {
      const tokens = extractTokens(`${candidate.title} ${candidate.extract}`, words);

      const score = [...tokens].reduce((sum, token) => sum + (contextWeights.get(token) ?? 0), 0);

      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score);

  const [best, second] = ranked;

  if (!best || best.score < 1) return null;
  if (best.score <= (second?.score ?? 0)) return null;

  return best.candidate;
}

function getContextTokenWeights(context: string, words: string[]): Map<string, number> {
  // 기존 단어 추출 결과는 일반 단서로 취급
  const weights = new Map(
    [...extractTokens(context, words)].map((token): [string, number] => [token, 1]),
  );

  let normalized = context.toLowerCase();

  for (const word of words) {
    if (word) {
      normalized = normalized.split(word.toLowerCase()).join(' ');
    }
  }

  const rawTokens = normalized.match(/[\p{L}\p{N}_]+/gu) ?? [];

  const rawTokenSet = new Set(rawTokens);

  for (const token of rawTokens) {
    if (!token.endsWith('에서')) continue;

    const root = token.slice(0, -2);

    // 다른 위치에서 독립적으로 등장한 단어는 유지
    if (root.length >= 2 && !rawTokenSet.has(root)) {
      weights.set(root, 0.25);
    }
  }

  return weights;
}

function extractTokens(text: string, words: string[]): Set<string> {
  let normalized = text.toLowerCase();

  for (const word of words) {
    if (word) {
      normalized = normalized.split(word.toLowerCase()).join(' ');
    }
  }

  const tokens = normalized.match(/[\p{L}\p{N}_]+/gu) ?? [];
  const particles = /(?:에서|으로|에게|부터|까지|은|는|이|가|을|를|의|에|와|과|도|만)$/u;

  return new Set(
    tokens
      .flatMap((token) => [token, token.replace(particles, '')])
      .filter((token) => Array.from(token).length >= 2),
  );
}
