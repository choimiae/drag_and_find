import type { LookupProvider } from './types';

export function withWorkerFailureFallback(
  worker: LookupProvider,
  wikipedia: LookupProvider,
): LookupProvider {
  return {
    async lookup(query) {
      const result = await worker.lookup(query);
      return result.status === 'network_error' || result.status === 'rate_limited'
        ? wikipedia.lookup(query)
        : result;
    },
  };
}
