
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

/**
 * 네이버 백과사전 검색 결과 중 첫 번째 항목을 조회한다.
 * 검색어와 제목이 일치하지 않으면 결과를 사용하지 않는다.
 */
export function createNaverProvider(
    credentials: Credentials,
    fetchFn: FetchFn = fetch,
): LookupProvider {
  return {
    async lookup(query): Promise<LookupResult> {
      const params = new URLSearchParams({
        query,
        display: '1',
        start: '1',
        format: 'json',
      });

      try {
        const response = await fetchFn(`${ENDPOINT}?${params}`, {
          headers: {
            'X-NCP-APIGW-API-KEY-ID': credentials.clientId,
            'X-NCP-APIGW-API-KEY': credentials.clientSecret,
          },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (response.status === 429) {
          return { status: 'rate_limited' };
        }

        if (response.status === 401 || response.status === 403) {
          console.error('네이버 API 인증 또는 권한 오류', response.status);
        }

        if (!response.ok) {
          return { status: 'network_error' };
        }

        const data = (await response.json()) as NaverResponse;

        const item = Array.isArray(data.items)
            ? (data.items[0] as NaverItem | undefined)
            : undefined;

        if (
            !item ||
            typeof item.title !== 'string' ||
            typeof item.description !== 'string' ||
            typeof item.link !== 'string'
        ) {
          return { status: 'not_found' };
        }

        const title = stripTags(item.title);

        // 검색어와 다른 제목의 결과는 제외한다.
        if (normalizeTitle(title) !== normalizeTitle(query)) {
          return { status: 'not_found' };
        }

        const url = safeUrl(item.link);

        if (!url) {
          return { status: 'not_found' };
        }

        return {
          status: 'found',
          source: 'naver',
          title,
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

/**
 * 공백, 대소문자, 유니코드 표기 차이를 정규화한다.
 */
function normalizeTitle(value: string): string {
  return value
      .normalize('NFKC')
      .replace(/\s+/gu, '')
      .toLowerCase();
}

function safeUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
