/** 뜻 모음 문서의 한 항목. title이 있으면 눌러서 그 문서를 찾을 수 있다. */
export interface Meaning {
  label: string;
  title: string | null;
}

/** 자동 선택 후보이자 "이 글에서는 아마"에 보여 줄 뜻. */
export interface SenseCandidate {
  title: string;
  extract: string;
  url: string;
}

/** 뜻 모음 문서에서 얻은 기본 뜻, 항목, 자동 선택 후보. */
export interface DisambiguationInfo {
  basic: string[];
  meanings: Meaning[];
  candidates: SenseCandidate[];
}

/** Worker가 반환하는 다른 출처의 설명. 주변 문맥은 포함하지 않는다. */
export interface LookupSourceResult {
  source: 'naver' | 'wikipedia';
  title: string;
  extract: string;
  url: string;
  isDisambiguation: boolean;
  disambiguation?: DisambiguationInfo;
}

/** 검색 출처가 돌려주는 결과. 출처가 바뀌어도 이 형식은 유지한다. */
export type LookupResult =
  | {
      status: 'found';
      source?: 'naver' | 'wikipedia';
      title: string;
      extract: string;
      url: string;
      isDisambiguation: boolean;
      disambiguation?: DisambiguationInfo;
      /** 문맥을 모르는 Worker는 후보를 함께 제공하고 브라우저가 선택한다. */
      alternatives?: LookupSourceResult[];
      suggestion?: SenseCandidate;
    }
  | { status: 'not_found' }
  | { status: 'rate_limited' }
  | { status: 'network_error' };

export type FoundResult = Extract<LookupResult, { status: 'found' }>;

/** 검색어 하나를 받아 결과를 돌려주는 검색 출처. */
export interface LookupProvider {
  lookup(query: string): Promise<LookupResult>;
}
