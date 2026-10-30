import { createWikipediaKoProvider, type FetchFn } from '../lib/lookup/wikipedia';
import { createNaverProvider } from './naver';
import { lookupSources } from './lookup';

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}
export interface WorkerEnv {
  NAVER_CLIENT_ID: string;
  NAVER_CLIENT_SECRET: string;
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
  const wikipedia = createWikipediaKoProvider({
    userAgent: 'DragAndFind/1.0.1 (https://github.com/choimiae/drag_and_find)',
    fetchFn,
  });
  return async (request) => {
    const url = new URL(request.url);
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
    const result = await lookupSources(query, naver, wikipedia);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  };
}

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return createWorkerHandler(env)(request);
  },
};
