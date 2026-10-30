import { stripTags } from '../lib/lookup/html-text';
import type { FetchFn } from '../lib/lookup/wikipedia';
import type { LookupProvider, LookupResult } from '../lib/lookup/types';

const ENDPOINT = 'https://naverapihub.apigw.ntruss.com/search/v1/encyc';
const TIMEOUT_MS = 5000;

interface Credentials {
  clientId: string;
  clientSecret: string;
}
interface NaverItem {
  title?: unknown;
  description?: unknown;
  link?: unknown;
}
interface NaverResponse {
  items?: unknown;
}

/** API HUB의 백과사전 검색 결과 중 첫 건만 요청한다. */
export function createNaverProvider(
  credentials: Credentials,
  fetchFn: FetchFn = fetch,
): LookupProvider {
  return {
    async lookup(query): Promise<LookupResult> {
      const params = new URLSearchParams({ query, display: '1', start: '1', format: 'json' });
      try {
        const response = await fetchFn(`${ENDPOINT}?${params}`, {
          headers: {
            'X-NCP-APIGW-API-KEY-ID': credentials.clientId,
            'X-NCP-APIGW-API-KEY': credentials.clientSecret,
          },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (response.status === 429) return { status: 'rate_limited' };
        if (response.status === 401 || response.status === 403) {
          console.error('네이버 API 인증 또는 권한 오류', response.status);
        }
        if (!response.ok) return { status: 'network_error' };
        const data = (await response.json()) as NaverResponse;
        const item = Array.isArray(data.items)
          ? (data.items[0] as NaverItem | undefined)
          : undefined;
        if (
          !item ||
          typeof item.title !== 'string' ||
          typeof item.description !== 'string' ||
          typeof item.link !== 'string'
        )
          return { status: 'not_found' };
        const url = safeUrl(item.link);
        if (!url) return { status: 'not_found' };
        return {
          status: 'found',
          source: 'naver',
          title: stripTags(item.title),
          extract: stripTags(item.description),
          url,
          isDisambiguation: false,
        };
      } catch {
        return { status: 'network_error' };
      }
    },
  };
}

function safeUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
