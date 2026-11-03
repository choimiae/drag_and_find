import { describe, expect, it, vi } from 'vitest';
import { createFallbackLookupService } from '../../../lib/lookup/fallback-service';
import { createLookupService } from '../../../lib/lookup/service';
import type { LookupResult } from '../../../lib/lookup/types';

const management: LookupResult = {
  status: 'found',
  source: 'wikipedia',
  title: '매니지먼트',
  extract: '여러 뜻',
  url: 'https://ko.wikipedia.org/wiki/매니지먼트',
  isDisambiguation: true,
  disambiguation: {
    basic: [],
    meanings: [
      { label: '관리', title: '관리' },
      { label: '경영', title: '경영' },
    ],
    candidates: [
      { title: '관리', extract: '어떤 것을 돌보는 일', url: 'https://ko.wikipedia.org/wiki/관리' },
      { title: '경영', extract: '기업을 운영하는 일', url: 'https://ko.wikipedia.org/wiki/경영' },
    ],
  },
};

describe('createFallbackLookupService', () => {
  it('shows direct Wikipedia without requesting English context from a failed Worker', async () => {
    const loadEnglishFromWorker = vi.fn(async () => ({ 관리: 'Application resource management' }));
    const workerLookup = createLookupService(
      { lookup: async () => ({ status: 'network_error' }) },
      undefined,
      loadEnglishFromWorker,
    );
    const wikipediaLookup = createLookupService({ lookup: async () => management });
    const lookup = createFallbackLookupService(workerLookup, wikipediaLookup);

    const result = await lookup(
      'Management',
      'Application resources and software systems need Management of application resources.',
    );
    expect(result.status).toBe('found');
    expect(loadEnglishFromWorker).not.toHaveBeenCalled();
  });

  it('keeps normal Worker results without direct Wikipedia lookup', async () => {
    const wikipediaLookup = vi.fn(async () => management);
    const lookup = createFallbackLookupService(
      async () => ({ status: 'not_found' }),
      wikipediaLookup,
    );
    expect(await lookup('없는문서')).toEqual({ status: 'not_found' });
    expect(wikipediaLookup).not.toHaveBeenCalled();
  });

  it('uses direct Wikipedia after a Worker rate limit', async () => {
    const lookup = createFallbackLookupService(
      async () => ({ status: 'rate_limited' }),
      async () => management,
    );
    expect(await lookup('Management')).toEqual(management);
  });
});
