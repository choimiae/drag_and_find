import type { LookupCache } from './cache';
import { pickSense } from './sense';
import type { LookupProvider, LookupResult, SenseCandidate } from './types';

export type LookupService = (query: string, context?: string) => Promise<LookupResult>;

/**
 * 출처별 결과는 캐시할 수 있지만 문맥에 따른 뜻 선택은 매번 브라우저에서 계산한다.
 * 선택한 단어 외의 주변 문장은 Worker로 전달하지 않는다.
 */
export function createLookupService(provider: LookupProvider, cache?: LookupCache): LookupService {
  return async (query, context) => {
    if (!cache) return withSuggestion(await provider.lookup(query), query, context);
    const key = query.toLowerCase();
    const cached = await cache.get(key).catch(() => undefined);
    const result = cached ?? (await provider.lookup(query));
    if (!cached && isWorthCaching(result)) {
      await cache.set(key, result).catch(() => undefined);
    }
    return withSuggestion(result, query, context);
  };
}

function isWorthCaching(result: LookupResult): boolean {
  return !(result.status === 'found' && result.isDisambiguation && !result.disambiguation);
}

function withSuggestion(
  result: LookupResult,
  query: string,
  context: string | undefined,
): LookupResult {
  if (result.status !== 'found' || !result.disambiguation || !context) return result;

  const candidates = [...result.disambiguation.candidates];
  const naver = result.alternatives?.find(
    (alternative) => alternative.source === 'naver' && !alternative.isDisambiguation,
  );

  if (naver) {
    candidates.push({
      title: naver.title,
      extract: naver.extract,
      url: naver.url,
    });
  }

  const suggestion = pickSense(context, [query, result.title], candidates);
  if (!suggestion) return result;

  if (naver && suggestion.url === naver.url) {
    // 네이버 설명이 문맥에 맞는 경우 해당 설명을 직접 먼저 보여 준다.
    return {
      status: 'found',
      source: 'naver',
      title: naver.title,
      extract: naver.extract,
      url: naver.url,
      isDisambiguation: false,
      alternatives: [{ source: result.source ?? 'wikipedia', title: result.title, extract: result.extract, url: result.url, isDisambiguation: result.isDisambiguation, disambiguation: result.disambiguation }],
    };
  }

  return { ...result, suggestion };
}
