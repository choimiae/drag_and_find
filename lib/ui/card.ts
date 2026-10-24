import type {
  DisambiguationInfo,
  FoundResult,
  LookupResult,
  Meaning,
  SenseCandidate,
} from '../lookup/types';
import { googleSearchUrl, naverSearchUrl } from '../search-urls';
import { MAX_QUERY_LENGTH } from '../selection';

export type CardState =
  { kind: 'loading' } | { kind: 'result'; result: LookupResult } | { kind: 'too_long' };

const MAX_MEANINGS = 8;
const MAX_LABEL_LENGTH = 40;

export interface CardHandlers {
  onClose(): void;
  onRetry(): void;
  onSelectMeaning(title: string): void;
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
  const actions = state.kind === 'too_long' ? [] : [buildActions(doc, query)];
  card.replaceChildren(header, body, ...actions);
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
    case 'not_found':
      return [doc.createTextNode('위키백과에 문서가 없습니다')];
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
      wikiLink(doc, result.url),
    ];
  }
  if (!result.disambiguation) {
    return [message(doc, '뜻이 여러 개인 단어입니다'), wikiLink(doc, result.url)];
  }
  return [
    ...disambiguationContent(doc, result.disambiguation, result.suggestion, onSelect),
    wikiLink(doc, result.url),
  ];
}

function disambiguationContent(
  doc: Document,
  info: DisambiguationInfo,
  suggestion: SenseCandidate | undefined,
  onSelect: (title: string) => void,
): Node[] {
  const others = info.meanings.filter(
    (meaning) => meaning.title === null || meaning.title !== suggestion?.title,
  );
  const basic = info.basic.map((line) =>
    element(doc, 'p', { className: 'card-basic', role: 'basic', text: line }),
  );
  return [
    ...(suggestion ? suggestionBlock(doc, suggestion, onSelect) : []),
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
): Node[] {
  const box = element(doc, 'div', { className: 'card-suggestion', role: 'suggestion-box' });
  box.append(
    element(doc, 'p', { className: 'card-chip', text: '이 글에서는 아마' }),
    meaningButton(doc, suggestion.title, suggestion.title, 'suggestion', onSelect),
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
  list.append(
    ...meanings.slice(0, MAX_MEANINGS).map((meaning) => meaningItem(doc, meaning, onSelect)),
  );
  const hidden = meanings.length - MAX_MEANINGS;
  return hidden > 0
    ? [
        list,
        element(doc, 'p', {
          className: 'card-more',
          role: 'more-meanings',
          text: `외 ${hidden}개`,
        }),
      ]
    : [list];
}

function meaningItem(
  doc: Document,
  meaning: Meaning,
  onSelect: (title: string) => void,
): HTMLElement {
  const item = element(doc, 'li', {});
  item.append(
    meaning.title === null
      ? element(doc, 'span', {
          className: 'card-meaning-text',
          role: 'meaning-text',
          text: shorten(meaning.label),
        })
      : meaningButton(doc, meaning.label, meaning.title, 'meaning', onSelect),
  );
  return item;
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

function buildActions(doc: Document, query: string): HTMLElement {
  const actions = element(doc, 'footer', { className: 'card-actions' });
  actions.append(
    actionLink(doc, googleSearchUrl(query), 'G', '구글 검색', 'google'),
    actionLink(doc, naverSearchUrl(query), 'N', '네이버 검색', 'naver'),
  );
  return actions;
}

function actionLink(
  doc: Document,
  href: string,
  mark: string,
  name: string,
  role: string,
): HTMLElement {
  const link = externalLink(doc, href, name, role, 'card-action');
  link.prepend(
    element(doc, 'span', { className: `card-action-mark card-action-mark-${role}`, text: mark }),
  );
  // 표시 글자(G/N)가 이름 앞에 붙어 읽히지 않도록 이름을 따로 준다.
  link.setAttribute('aria-label', name);
  return link;
}

function message(doc: Document, text: string): HTMLElement {
  return element(doc, 'p', { className: 'card-message', text });
}

function wikiLink(doc: Document, url: string): HTMLElement {
  return externalLink(doc, url, '위키백과에서 보기 →', 'wiki-link', 'card-link');
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
