import type {
  DisambiguationInfo,
  FoundResult,
  LookupResult,
  Meaning,
  SenseCandidate,
} from '../lookup/types';
import { searchUrl } from '../search-urls';
import { MAX_QUERY_LENGTH } from '../selection';
import type { SearchEngine } from '../settings';

export type CardState =
  { kind: 'loading' } | { kind: 'result'; result: LookupResult } | { kind: 'too_long' };

const MAX_LABEL_LENGTH = 40;
const LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/deed.ko';
const CC0_URL = 'https://creativecommons.org/publicdomain/zero/1.0/deed.ko';

export interface CardHandlers {
  onClose(): void;
  onRetry(): void;
  onSelectMeaning(title: string): void;
  /** Enter를 누른 순간 바로 읽어야 하므로 동기 함수다 (새 탭이 팝업 차단에 걸리지 않게). */
  getSearchEngine(): SearchEngine;
}

interface ElementOptions {
  className?: string;
  role?: string;
  text?: string;
}

/** 카드 내용을 상태에 맞게 다시 그린다. 외부 문자열은 모두 textContent로만 넣는다. */
export function renderCard(
  card: HTMLElement,
  query: string,
  state: CardState,
  handlers: CardHandlers,
): void {
  const doc = card.ownerDocument;
  const header = buildHeader(doc, titleFor(query, state), isAmbiguous(state), handlers.onClose);
  const body = element(doc, 'div', { className: 'card-body', role: 'body' });
  body.append(...bodyContent(doc, state, handlers));
  const sourceResult =
    state.kind === 'result' && state.result.status === 'found' && state.result.isDisambiguation
      ? state.result
      : null;
  const pinnedSource = sourceResult ? element(doc, 'div', { className: 'card-source' }) : null;
  if (pinnedSource && sourceResult) {
    pinnedSource.append(sourceLinksRow(doc, sourceResult), attribution(doc, sourceResult));
  }
  const keptFooter = state.kind === 'too_long' ? undefined : sameQueryFooter(card, query);
  if (keptFooter) {
    // 입력칸을 문서에 둔 채로 위아래만 바꿔야 한글 조합·실행 취소 기록·포커스가 끊기지 않는다.
    for (const child of Array.from(card.children)) if (child !== keptFooter) child.remove();
    keptFooter.before(header, body, ...(pinnedSource ? [pinnedSource] : []));
    return;
  }
  const actions =
    state.kind === 'too_long' ? [] : [buildActions(doc, query, handlers.getSearchEngine)];
  card.replaceChildren(header, body, ...(pinnedSource ? [pinnedSource] : []), ...actions);
}

/** 같은 검색어로 다시 그릴 때만, 사용자가 고친 값이 든 검색 줄을 그대로 돌려준다. */
function sameQueryFooter(card: HTMLElement, query: string): HTMLElement | undefined {
  const input = card.querySelector<HTMLInputElement>('[data-role="search-input"]');
  if (!input || input.dataset.query !== query) return undefined;
  return input.closest<HTMLElement>('footer') ?? undefined;
}

function titleFor(query: string, state: CardState): string {
  if (state.kind === 'too_long') return '선택한 글';
  if (state.kind === 'result' && state.result.status === 'found') return state.result.title;
  return query;
}

function isAmbiguous(state: CardState): boolean {
  return (
    state.kind === 'result' && state.result.status === 'found' && state.result.isDisambiguation
  );
}

function bodyContent(doc: Document, state: CardState, handlers: CardHandlers): Node[] {
  if (state.kind === 'loading') return [doc.createTextNode('찾는 중…')];
  if (state.kind === 'too_long') {
    return [doc.createTextNode(`선택이 너무 깁니다 (${MAX_QUERY_LENGTH}자 이하)`)];
  }
  const { result } = state;
  switch (result.status) {
    case 'found':
      return foundContent(doc, result, handlers.onSelectMeaning);
    case 'not_found': {
      if (!result.related) {
        return [doc.createTextNode('네이버 백과와 위키백과에 결과가 없습니다')];
      }

      const related = result.related;

      return [
        message(doc, '정확히 일치하는 설명은 찾지 못했습니다.'),
        sectionTitle(doc, `관련 문서: ${related.title}`),
        element(doc, 'p', {
          className: 'card-extract',
          role: 'related-extract',
          text: related.extract,
        }),
        externalLink(doc, related.url, '네이버 백과에서 보기 →', 'related-link', 'card-link'),
        element(doc, 'p', {
          className: 'card-attribution',
          role: 'attribution',
          text: '출처: 네이버 백과 검색 결과',
        }),
      ];
    }
    case 'rate_limited':
      return [doc.createTextNode('요청이 많아 잠시 막혔습니다. 잠시 후 다시 시도해 주세요')];
    case 'network_error':
      return [doc.createTextNode('연결에 실패했습니다'), retryButton(doc, handlers.onRetry)];
  }
}

function foundContent(
  doc: Document,
  result: FoundResult,
  onSelect: (title: string) => void,
): Node[] {
  if (!result.isDisambiguation) {
    return [
      element(doc, 'p', { className: 'card-extract', role: 'extract', text: result.extract }),
      sourceLinksRow(doc, result),
      attribution(doc, result),
    ];
  }
  if (!result.disambiguation) {
    return [message(doc, '뜻이 여러 개인 단어입니다')];
  }
  return disambiguationContent(doc, result.disambiguation, result.suggestion, onSelect);
}

function disambiguationContent(
  doc: Document,
  info: DisambiguationInfo,
  suggestion: SenseCandidate | undefined,
  onSelect: (title: string) => void,
): Node[] {
  const suggestedSourceUrl = suggestion
    ? info.meanings.find(
        (meaning) => meaning.title === null && meaning.sourceUrl === suggestion.url,
      )?.sourceUrl
    : undefined;
  const others = info.meanings.filter(
    (meaning) =>
      (!suggestedSourceUrl || meaning.sourceUrl !== suggestedSourceUrl) &&
      (meaning.title === null || meaning.title !== suggestion?.title),
  );
  const basic = info.basic.map((line) =>
    element(doc, 'p', { className: 'card-basic', role: 'basic', text: line }),
  );
  return [
    ...(suggestion ? suggestionBlock(doc, suggestion, onSelect, suggestedSourceUrl) : []),
    ...(basic.length > 0 ? [sectionTitle(doc, '기본 뜻'), ...basic] : []),
    ...(others.length > 0
      ? [sectionTitle(doc, '다른 뜻'), ...meaningList(doc, others, onSelect)]
      : []),
  ];
}

function suggestionBlock(
  doc: Document,
  suggestion: SenseCandidate,
  onSelect: (title: string) => void,
  sourceUrl?: string,
): Node[] {
  const box = element(doc, 'div', { className: 'card-suggestion', role: 'suggestion-box' });
  const safeUrl = safeMeaningSourceUrl(sourceUrl);
  const action = safeUrl
    ? externalLink(doc, safeUrl, shorten(suggestion.title), 'suggestion', 'card-meaning')
    : meaningButton(doc, suggestion.title, suggestion.title, 'suggestion', onSelect);
  if (safeUrl) action.setAttribute('aria-label', `${suggestion.title} 원문 보기`);
  box.append(
    element(doc, 'p', { className: 'card-chip', text: '이 글에서는 아마' }),
    action,
    element(doc, 'p', {
      className: 'card-suggestion-extract',
      role: 'suggestion-extract',
      text: suggestion.extract,
    }),
  );
  return [box];
}

function meaningList(
  doc: Document,
  meanings: Meaning[],
  onSelect: (title: string) => void,
): Node[] {
  const list = element(doc, 'ul', { className: 'card-meanings', role: 'meanings' });
  list.append(...meanings.map((meaning) => meaningItem(doc, meaning, onSelect)));
  return [list];
}

function meaningItem(
  doc: Document,
  meaning: Meaning,
  onSelect: (title: string) => void,
): HTMLElement {
  const item = element(doc, 'li', {});
  const row =
    meaning.title === null
      ? element(doc, 'div', { className: 'card-meaning-text', role: 'meaning-text' })
      : element(doc, 'button', { className: 'card-meaning', role: 'meaning' });
  if (meaning.title !== null) {
    row.setAttribute('type', 'button');
    row.addEventListener('click', () => onSelect(meaning.title!));
  }
  row.append(
    element(doc, 'span', { className: 'card-meaning-label', text: shorten(meaning.label) }),
    element(doc, 'span', {
      className: 'card-meaning-description',
      role: 'meaning-description',
      text: meaning.description || '간단한 설명이 없습니다.',
    }),
  );
  const sourceUrl = meaning.title === null ? safeMeaningSourceUrl(meaning.sourceUrl) : null;
  if (sourceUrl) {
    const link = externalLink(
      doc,
      sourceUrl,
      '원문 보기 →',
      'meaning-source-link',
      'card-meaning-source-link',
    );
    link.setAttribute(
      'aria-label',
      `${meaning.label}: ${meaning.description || '설명 없음'} 원문 보기`,
    );
    row.append(link);
  }
  item.append(row);
  return item;
}

function safeMeaningSourceUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (url.hostname === 'www.wikidata.org' && /^\/wiki\/Q[1-9]\d*$/u.test(url.pathname)) {
      return url.href;
    }
    if (url.hostname === 'ko.wikipedia.org' && url.pathname.startsWith('/wiki/')) {
      return url.href;
    }
  } catch {
    return null;
  }
  return null;
}

function meaningButton(
  doc: Document,
  label: string,
  title: string,
  role: string,
  onSelect: (title: string) => void,
): HTMLElement {
  const button = element(doc, 'button', { className: 'card-meaning', role, text: shorten(label) });
  button.setAttribute('type', 'button');
  button.addEventListener('click', () => onSelect(title));
  return button;
}

function sectionTitle(doc: Document, text: string): HTMLElement {
  return element(doc, 'p', { className: 'card-section-title', text });
}

function shorten(text: string): string {
  const chars = Array.from(text);
  return chars.length > MAX_LABEL_LENGTH ? `${chars.slice(0, MAX_LABEL_LENGTH).join('')}…` : text;
}

function buildHeader(
  doc: Document,
  title: string,
  ambiguous: boolean,
  onClose: () => void,
): HTMLElement {
  const header = element(doc, 'header', { className: 'card-header' });
  const heading = element(doc, 'span', { className: 'card-heading' });
  heading.append(element(doc, 'strong', { className: 'card-title', role: 'title', text: title }));
  if (ambiguous) {
    heading.append(
      element(doc, 'span', { className: 'card-badge', role: 'badge', text: '뜻 여러 개' }),
    );
  }
  const close = element(doc, 'button', { className: 'card-close', role: 'close', text: '✕' });
  close.setAttribute('type', 'button');
  close.setAttribute('aria-label', '닫기');
  close.addEventListener('click', onClose);
  header.append(heading, close);
  return header;
}

function buildActions(
  doc: Document,
  query: string,
  getSearchEngine: () => SearchEngine,
): HTMLElement {
  const actions = element(doc, 'footer', { className: 'card-actions' });
  const input = searchInput(doc, query);
  const links = {
    google: actionLink(doc, '구글', 'google'),
    naver: actionLink(doc, '네이버', 'naver'),
  };
  const refresh = () => updateLinks(links, input.value);
  input.addEventListener('input', refresh);
  input.addEventListener('keydown', (event) => {
    event.stopPropagation();
    // 한글 조합 중 Enter는 글자 확정용이라 검색하지 않는다.
    if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    const link = links[getSearchEngine()];
    if (link.hasAttribute('href')) link.click();
  });
  // 페이지의 단축키가 입력 중인 글자를 가로채지 못하게 막는다.
  input.addEventListener('keyup', (event) => event.stopPropagation());
  input.addEventListener('keypress', (event) => event.stopPropagation());
  refresh();
  actions.append(input, links.google, links.naver);
  return actions;
}

function searchInput(doc: Document, query: string): HTMLInputElement {
  const input = element(doc, 'input', {
    className: 'card-search-input',
    role: 'search-input',
  }) as HTMLInputElement;
  input.type = 'text';
  input.value = query;
  input.dataset.query = query;
  input.setAttribute('aria-label', '검색어');
  input.setAttribute('spellcheck', 'false');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('enterkeyhint', 'search');
  return input;
}

/** 입력칸 값(앞뒤 공백 제외)으로 두 링크를 갱신한다. 비었으면 링크를 끈다. */
function updateLinks(links: Record<SearchEngine, HTMLElement>, value: string): void {
  const text = value.trim();
  for (const engine of Object.keys(links) as SearchEngine[]) {
    const link = links[engine];
    if (text === '') {
      link.removeAttribute('href');
      // href가 없으면 링크 역할이 사라지므로, 꺼진 링크로 읽히도록 역할을 직접 준다.
      link.setAttribute('role', 'link');
      link.setAttribute('aria-disabled', 'true');
    } else {
      link.setAttribute('href', searchUrl(engine, text));
      link.removeAttribute('role');
      link.removeAttribute('aria-disabled');
    }
  }
}

function actionLink(doc: Document, name: string, role: string): HTMLElement {
  const link = externalLink(doc, '', name, role, 'card-action');
  link.removeAttribute('href');
  link.setAttribute('aria-label', `${name} 검색`);
  link.setAttribute('title', `${name} 검색`);
  return link;
}

function message(doc: Document, text: string): HTMLElement {
  return element(doc, 'p', { className: 'card-message', text });
}

function alternativeLinks(doc: Document, result: FoundResult): HTMLElement[] {
  return (result.alternatives ?? []).flatMap((alternative) => {
    if (!alternative.url.startsWith('https://')) return [];
    return [
      externalLink(
        doc,
        alternative.url,
        `${sourceName(alternative.source)} ↗`,
        'alternative-link',
        'card-source-link',
      ),
    ];
  });
}

function sourceLinksRow(doc: Document, result: FoundResult): HTMLElement {
  const row = element(doc, 'div', { className: 'card-source-links', role: 'source-links' });
  row.append(
    element(doc, 'span', { className: 'card-source-label', text: '원문' }),
    sourceLink(doc, result),
  );
  if (!result.isDisambiguation) {
    for (const alternative of alternativeLinks(doc, result)) {
      row.append(element(doc, 'span', { className: 'card-source-separator' }), alternative);
    }
  }
  return row;
}

function sourceLink(doc: Document, result: FoundResult): HTMLElement {
  const wikipedia = result.source === undefined || result.source === 'wikipedia';
  return externalLink(
    doc,
    result.url,
    `${sourceName(result.source)} ↗`,
    wikipedia ? 'wiki-link' : 'source-link',
    'card-source-link',
  );
}

/** 위키백과 글을 보여 줄 때 붙이는 출처·라이선스 표기. */
function attribution(doc: Document, result: FoundResult): HTMLElement {
  const line = element(doc, 'p', { className: 'card-attribution', role: 'attribution' });
  if (result.source === 'naver') {
    line.textContent = '출처: 네이버 백과 검색 결과';
    return line;
  }
  if (result.source === 'wikidata') {
    line.append(
      doc.createTextNode('출처: 위키데이터 ('),
      externalLink(doc, CC0_URL, 'CC0', 'license-link', 'card-license'),
      doc.createTextNode(')'),
    );
    return line;
  }
  line.append(
    doc.createTextNode(
      result.isDisambiguation && !result.disambiguation
        ? '출처: 위키백과 ('
        : '출처: 위키백과 설명 일부 (',
    ),
    externalLink(doc, LICENSE_URL, 'CC BY-SA 4.0', 'license-link', 'card-license'),
    doc.createTextNode(')'),
  );
  return line;
}

function sourceName(source: FoundResult['source']): string {
  if (source === 'naver') return '네이버 백과';
  if (source === 'wikidata') return '위키데이터';
  return '위키백과';
}

function retryButton(doc: Document, onRetry: () => void): HTMLElement {
  const button = element(doc, 'button', {
    className: 'card-retry',
    role: 'retry',
    text: '다시 시도',
  });
  button.setAttribute('type', 'button');
  button.addEventListener('click', onRetry);
  return button;
}

function externalLink(
  doc: Document,
  href: string,
  text: string,
  role: string,
  className: string,
): HTMLElement {
  const link = element(doc, 'a', { className, role, text });
  link.setAttribute('href', href);
  link.setAttribute('target', '_blank');
  link.setAttribute('rel', 'noopener noreferrer');
  return link;
}

function element(doc: Document, tag: string, options: ElementOptions): HTMLElement {
  const node = doc.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.role) node.dataset.role = options.role;
  if (options.text !== undefined) node.textContent = options.text;
  return node;
}
