import { getWorkerMetrics } from './cloudflare';
import { checkLookupHealth } from './health';
import { getWebStoreMetrics } from './webstore';
import { getUsageMetrics } from './ga4';
import { verifyAccess, type AccessEnv } from './access';
import type { DashboardResponse, Section } from './types';

export interface AdminEnv extends AccessEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  CF_API_TOKEN?: string;
  CF_ACCOUNT_ID?: string;
  CF_SCRIPT_NAME?: string;
  LOOKUP_WORKER_URL?: string;
  LOOKUP_SERVICE?: { fetch: typeof fetch };
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  CWS_PUBLISHER_ID?: string;
  CWS_ITEM_ID?: string;
  GA4_PROPERTY_ID?: string;
}

async function section<T>(run: () => Promise<T>): Promise<Section<T>> {
  try {
    return { status: 'ready', data: await run(), updatedAt: new Date().toISOString() };
  } catch {
    return { status: 'error', message: '통계를 가져오지 못했습니다.' };
  }
}

export async function handleAdminRequest(
  request: Request,
  env: AdminEnv,
  fetchFn: typeof fetch = fetch,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== '/api/dashboard') {
    if (url.pathname.startsWith('/api/')) return new Response(null, { status: 404 });
    return env.ASSETS.fetch(request);
  }
  if (request.method !== 'GET') return new Response(null, { status: 405 });
  const rawDays = url.searchParams.get('days') ?? '7';
  if (rawDays !== '1' && rawDays !== '7' && rawDays !== '30')
    return Response.json(
      { error: 'invalid_period' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  const days = Number(rawDays) as 1 | 7 | 30;
  const [store, worker, health, usage] = await Promise.all([
    env.GOOGLE_SERVICE_ACCOUNT_JSON && env.CWS_PUBLISHER_ID && env.CWS_ITEM_ID
      ? section(() => getWebStoreMetrics(env, days, fetchFn))
      : Promise.resolve({ status: 'connection_required' } as const),
    env.CF_API_TOKEN && env.CF_ACCOUNT_ID
      ? section(() =>
          getWorkerMetrics(
            env.CF_API_TOKEN!,
            env.CF_ACCOUNT_ID!,
            env.CF_SCRIPT_NAME ?? 'drag-and-find-lookup',
            days,
            fetchFn,
          ),
        )
      : Promise.resolve({ status: 'connection_required' } as const),
    env.LOOKUP_WORKER_URL
      ? section(() =>
          checkLookupHealth(
            env.LOOKUP_WORKER_URL!,
            env.LOOKUP_SERVICE?.fetch.bind(env.LOOKUP_SERVICE) ?? fetchFn,
          ),
        )
      : Promise.resolve({ status: 'connection_required' } as const),
    env.GOOGLE_SERVICE_ACCOUNT_JSON && env.GA4_PROPERTY_ID
      ? section(() => getUsageMetrics(env, days, fetchFn))
      : Promise.resolve({ status: 'connection_required' } as const),
  ]);
  const dashboard: DashboardResponse = {
    days,
    store,
    worker,
    health,
    usage,
  };
  return Response.json(dashboard, { headers: { 'Cache-Control': 'no-store' } });
}

export default {
  async fetch(request: Request, env: AdminEnv): Promise<Response> {
    if (!(await verifyAccess(request, env))) return new Response(null, { status: 403 });
    return handleAdminRequest(request, env);
  },
};
