/** 검색 출처가 돌려주는 결과. 출처가 바뀌어도 이 형식은 유지한다. */
export type LookupResult =
  | { status: 'found'; title: string; extract: string; url: string; isDisambiguation: boolean }
  | { status: 'not_found' }
  | { status: 'rate_limited' }
  | { status: 'network_error' };

/** 검색어 하나를 받아 결과를 돌려주는 검색 출처. */
export interface LookupProvider {
  lookup(query: string): Promise<LookupResult>;
}
