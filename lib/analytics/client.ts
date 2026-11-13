import type { LookupResult } from '../lookup/types';
import { loadUsagePreference } from './usage-preference';

interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(values: Record<string, string>): Promise<void>;
}

export interface AnalyticsOptions {
  workerUrl: string;
  version: string;
  storage: StorageArea;
  fetchFn?: typeof fetch;
}

const CLIENT_ID_KEY = 'analyticsClientId';
const GA4_CLIENT_ID = /^[1-9]\d{0,9}\.[1-9]\d{0,9}$/;

export function createAnalyticsClient({
  workerUrl,
  version,
  storage,
  fetchFn = fetch,
}: AnalyticsOptions) {
  let clientIdPromise: Promise<string> | undefined;
  const clientId = () =>
    (clientIdPromise ??= (async () => {
      const existing = (await storage.get(CLIENT_ID_KEY))[CLIENT_ID_KEY];
      if (typeof existing === 'string' && GA4_CLIENT_ID.test(existing)) return existing;
      const created = Array.from(crypto.getRandomValues(new Uint32Array(2)), (part) =>
        String(part || 1),
      ).join('.');
      await storage.set({ [CLIENT_ID_KEY]: created });
      return created;
    })());

  return {
    async recordLookupOutcome(result: LookupResult): Promise<void> {
      if (!workerUrl) return;
      try {
        if (!(await loadUsagePreference(storage))) return;
        const url = new URL('/telemetry', workerUrl);
        await fetchFn(url.href, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: await clientId(),
            event:
              result.status === 'found' || result.status === 'not_found'
                ? 'lookup_completed'
                : 'lookup_failed',
            version,
          }),
          signal: AbortSignal.timeout(5_000),
        });
      } catch {
        // 통계 전송 실패는 단어 조회에 영향을 주지 않는다.
      }
    },
  };
}
