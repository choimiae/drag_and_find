import { createWikipediaKoProvider, type FetchFn } from '../lib/lookup/wikipedia';
import { withEnglishWikipediaFallback } from '../lib/lookup/wikipedia-en';
import { createNaverProvider } from './naver';
import { createWikidataProvider } from './wikidata';
import { lookupSources } from './lookup';
import { fetchEnglishExtracts, MAX_ENGLISH_CONTEXT_TITLES } from '../lib/lookup/wikipedia-context';
import { handleTelemetry } from './telemetry';

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}
export interface WorkerEnv {
  NAVER_CLIENT_ID: string;
  NAVER_CLIENT_SECRET: string;
  GA4_MEASUREMENT_ID?: string;
  GA4_API_SECRET?: string;
  RATE_LIMITER?: RateLimiter;
}

export function createWorkerHandler(
  env: WorkerEnv,
  fetchFn: FetchFn = fetch,
): (request: Request) => Promise<Response> {
  const naver = createNaverProvider(
    { clientId: env.NAVER_CLIENT_ID, clientSecret: env.NAVER_CLIENT_SECRET },
    fetchFn,
  );
  const wikipediaUserAgent = 'DragAndFind/1.0.3 (https://github.com/choimiae/drag_and_find)';

  const wikipediaKo = createWikipediaKoProvider({
    userAgent: wikipediaUserAgent,
    fetchFn,
  });

  const wikipediaFallback = withEnglishWikipediaFallback(wikipediaKo, {
    userAgent: wikipediaUserAgent,
    fetchFn,
  });

  const wikipedia = wikipediaFallback;
  const wikidata = createWikidataProvider(wikipediaUserAgent, wikipediaKo, fetchFn);
  return async (request) => {
    const url = new URL(request.url);
    if (url.pathname === '/telemetry') {
      if (request.method !== 'POST') return new Response(null, { status: 405 });
      return handleTelemetry(request, env, fetchFn);
    }
    if (request.method === 'POST' && url.pathname === '/english-context') {
      let titles: string[];
      try {
        const raw = await request.text();
        if (raw.length > 4000) throw new Error('body too large');
        const body: unknown = JSON.parse(raw);
        if (
          typeof body !== 'object' ||
          body === null ||
          !('titles' in body) ||
          !Array.isArray(body.titles) ||
          body.titles.length < 1 ||
          body.titles.length > MAX_ENGLISH_CONTEXT_TITLES ||
          !body.titles.every(
            (title: unknown) =>
              typeof title === 'string' &&
              title.length >= 1 &&
              title.length <= 100 &&
              title.trim() === title &&
              !title.includes('|') &&
              ![...title].some((char) => char.charCodeAt(0) < 32),
          )
        )
          throw new Error('invalid titles');
        titles = body.titles;
      } catch {
        return Response.json({ error: 'invalid_titles' }, { status: 400 });
      }
      if (env.RATE_LIMITER) {
        const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
        const allowed = await env.RATE_LIMITER.limit({ key: ip });
        if (!allowed.success) return Response.json({ status: 'rate_limited' }, { status: 429 });
      }
      const extracts = await fetchEnglishExtracts(
        [...new Set(titles)],
        wikipediaUserAgent,
        fetchFn,
      );
      return Response.json({ extracts }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (request.method !== 'GET' || url.pathname !== '/lookup')
      return new Response(null, { status: 404 });
    const query = url.searchParams.get('query') ?? '';
    if (query.trim() !== query || Array.from(query).length < 1 || Array.from(query).length > 50)
      return Response.json({ error: 'invalid_query' }, { status: 400 });
    if (env.RATE_LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const allowed = await env.RATE_LIMITER.limit({ key: ip });
      if (!allowed.success) return Response.json({ status: 'rate_limited' }, { status: 429 });
    }
    const primary = await lookupSources(query, naver, wikipedia);
    const extra = primary.status === 'not_found' ? await wikidata.lookup(query) : primary;
    const result = extra.status === 'found' ? extra : primary;
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  };
}

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return createWorkerHandler(env)(request);
  },
};
