import type { LookupService } from './service';

export function createFallbackLookupService(
  workerLookup: LookupService,
  wikipediaLookup: LookupService,
): LookupService {
  return async (query, context) => {
    const result = await workerLookup(query, context);
    return result.status === 'network_error' || result.status === 'rate_limited'
      ? wikipediaLookup(query, context)
      : result;
  };
}
