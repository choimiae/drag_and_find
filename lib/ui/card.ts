import type { LookupResult } from '../lookup/types';
import { googleSearchUrl, naverSearchUrl } from '../search-urls';
import { MAX_QUERY_LENGTH } from '../selection';

export type CardState =
  { kind: 'loading' } | { kind: 'result'; result: LookupResult } | { kind: 'too_long' };

export interface CardHandlers {
  onClose(): void;
  onRetry(): void;
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
  const header = buildHeader(doc, titleFor(query, state), handlers.onClose);
  const body = element(doc, 'div', { className: 'card-body', role: 'body' });
  body.append(...bodyContent(doc, state, handlers.onRetry));
  const actions = state.kind === 'too_long' ? [] : [buildActions(doc, query)];
  card.replaceChildren(header, body, ...actions);
}

function titleFor(query: string, state: CardState): string {
  if (state.kind === 'too_long') return '선택한 글';
  if (state.kind === 'result' && state.result.status === 'found') return state.result.title;
  return query;
}

function bodyContent(doc: Document, state: CardState, onRetry: () => void): Node[] {
  if (state.kind === 'loading') return [doc.createTextNode('찾는 중…')];
  if (state.kind === 'too_long') {
    return [doc.createTextNode(`선택이 너무 깁니다 (${MAX_QUERY_LENGTH}자 이하)`)];
  }
  const { result } = state;
  switch (result.status) {
    case 'found':
      return result.isDisambiguation
        ? [message(doc, '뜻이 여러 개인 단어입니다'), wikiLink(doc, result.url)]
        : [
            element(doc, 'p', { className: 'card-extract', role: 'extract', text: result.extract }),
            wikiLink(doc, result.url),
          ];
    case 'not_found':
      return [doc.createTextNode('위키백과에 문서가 없습니다')];
    case 'rate_limited':
      return [doc.createTextNode('요청이 많아 잠시 막혔습니다. 잠시 후 다시 시도해 주세요')];
    case 'network_error':
      return [doc.createTextNode('연결에 실패했습니다'), retryButton(doc, onRetry)];
  }
}

function buildHeader(doc: Document, title: string, onClose: () => void): HTMLElement {
  const header = element(doc, 'header', { className: 'card-header' });
  const close = element(doc, 'button', { className: 'card-close', role: 'close', text: '✕' });
  close.setAttribute('type', 'button');
  close.setAttribute('aria-label', '닫기');
  close.addEventListener('click', onClose);
  header.append(
    element(doc, 'strong', { className: 'card-title', role: 'title', text: title }),
    close,
  );
  return header;
}

function buildActions(doc: Document, query: string): HTMLElement {
  const actions = element(doc, 'footer', { className: 'card-actions' });
  actions.append(
    externalLink(doc, googleSearchUrl(query), '구글 검색', 'google', 'card-action'),
    externalLink(doc, naverSearchUrl(query), '네이버 검색', 'naver', 'card-action'),
  );
  return actions;
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
