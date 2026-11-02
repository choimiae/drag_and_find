import type { FetchFn } from '../lib/lookup/wikipedia';
import type { LookupProvider, LookupResult, SenseCandidate } from '../lib/lookup/types';

const ENDPOINT = 'https://www.wikidata.org/w/api.php';
const TIMEOUT_MS = 5000;
const MAX_RESULTS = 10;

interface SearchHit {
  id?: string;
  match?: { text?: string };
}

interface Entity {
  labels?: Record<string, { value?: string }>;
  descriptions?: Record<string, { value?: string }>;
  sitelinks?: { kowiki?: { title?: string } };
}

function normalized(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase();
}

/** 한국어 백과 문서가 없을 때 위키데이터의 정확한 이름·별칭만 조회한다. */
export function createWikidataProvider(
  userAgent: string,
  koreanWikipedia: LookupProvider,
  fetchFn: FetchFn = fetch,
): LookupProvider {
  async function request(params: Record<string, string>): Promise<unknown> {
    const url = `${ENDPOINT}?${new URLSearchParams({ ...params, format: 'json' })}`;
    const response = await fetchFn(url, {
      headers: { 'User-Agent': userAgent, 'Api-User-Agent': userAgent },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return response.json();
  }

  return {
    async lookup(query): Promise<LookupResult> {
      try {
        const found = (await request({
          action: 'wbsearchentities',
          search: query,
          language: 'ko',
          limit: String(MAX_RESULTS),
        })) as { search?: SearchHit[] } | null;
        const ids = Array.isArray(found?.search)
          ? [
              ...new Set(
                found.search
                  .filter(
                    (hit) =>
                      hit.id && hit.match?.text && normalized(hit.match.text) === normalized(query),
                  )
                  .map((hit) => hit.id as string),
              ),
            ]
          : [];
        if (ids.length === 0) return { status: 'not_found' };

        const details = (await request({
          action: 'wbgetentities',
          ids: ids.join('|'),
          props: 'labels|descriptions|sitelinks',
          languages: 'ko|en',
          sitefilter: 'kowiki',
        })) as { entities?: Record<string, Entity> } | null;
        const candidates: Array<SenseCandidate & { wikipediaTitle?: string }> = ids.flatMap(
          (id) => {
            const entity = details?.entities?.[id];
            const wikipediaTitle = entity?.sitelinks?.kowiki?.title;
            const title = entity?.labels?.ko?.value || wikipediaTitle;
            const extract = entity?.descriptions?.ko?.value ?? '';
            if (!title || (!extract && !wikipediaTitle)) return [];
            const englishTitle = entity?.labels?.en?.value;
            return [
              {
                title,
                extract,
                url: extract
                  ? `https://www.wikidata.org/wiki/${encodeURIComponent(id)}`
                  : `https://ko.wikipedia.org/wiki/${encodeURIComponent(wikipediaTitle ?? '')}`,
                ...(wikipediaTitle ? { wikipediaTitle } : {}),
                ...(englishTitle && normalized(englishTitle) !== normalized(title)
                  ? { aliases: [englishTitle] }
                  : {}),
              },
            ];
          },
        );
        if (candidates.length === 0) return { status: 'not_found' };
        if (candidates.length === 1) {
          const candidate = candidates[0];
          if (!candidate) return { status: 'not_found' };
          if (!candidate.extract && candidate.wikipediaTitle) {
            const article = await koreanWikipedia.lookup(candidate.wikipediaTitle);
            return article.status === 'found' ? article : { status: 'not_found' };
          }
          return {
            status: 'found',
            source: 'wikidata',
            title: candidate.title,
            extract: candidate.extract,
            url: candidate.url,
            isDisambiguation: false,
          };
        }
        return {
          status: 'found',
          source: 'wikidata',
          title: query,
          extract: '',
          url: `https://www.wikidata.org/w/index.php?${new URLSearchParams({ search: query })}`,
          isDisambiguation: true,
          disambiguation: {
            basic: [],
            meanings: candidates.map((candidate) => ({
              label: candidate.title,
              ...(candidate.extract ? { description: candidate.extract } : {}),
              title: normalized(candidate.title) === normalized(query) ? null : candidate.title,
              ...(normalized(candidate.title) === normalized(query)
                ? { sourceUrl: candidate.url }
                : {}),
            })),
            candidates: candidates.filter((candidate) => candidate.extract !== ''),
          },
        };
      } catch {
        return { status: 'network_error' };
      }
    },
  };
}
