/** 검색어로 구글 검색 결과 주소를 만든다. */
export function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/** 검색어로 네이버 통합검색 결과 주소를 만든다. */
export function naverSearchUrl(query: string): string {
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
}
