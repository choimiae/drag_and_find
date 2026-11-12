import type { LookupResult } from './lookup/types';
import { checkSelection } from './selection';
import { DEFAULT_SETTINGS, type ThemeSetting } from './settings';
import { renderCard, type CardState } from './ui/card';
import { OVERLAY_CSS } from './ui/styles';

export interface SidepanelView {
  showSelection(selection: string): void;
  setTheme(theme: ThemeSetting): void;
  clear(): void;
}

/** 우클릭으로 받은 글자를 기존 카드 모양으로 보여 준다. PDF 내용에는 접근하지 않는다. */
export function createSidepanelView(
  doc: Document,
  lookup: (query: string) => Promise<LookupResult>,
): SidepanelView {
  const host = doc.createElement('main');
  host.dataset.theme = DEFAULT_SETTINGS.theme;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = `${OVERLAY_CSS}
    :host { display: block; min-height: 100vh; box-sizing: border-box; padding: 12px; background: var(--dnf-surface-alt); }
    .card { position: static; width: 100%; max-height: calc(100vh - 24px); box-shadow: none; }
    .empty { color: var(--dnf-muted); padding: 16px 4px; font-size: 13px; }
  `;
  const empty = doc.createElement('p');
  empty.className = 'empty';
  empty.textContent = 'PDF에서 단어를 선택한 뒤 우클릭하여 찾아보세요.';
  const card = doc.createElement('section');
  card.className = 'card';
  card.dataset.role = 'card';
  shadow.append(style, empty);
  doc.body.append(host);

  let requestId = 0;
  let currentQuery = '';
  let meaningRoot: { query: string; result: LookupResult } | null = null;

  function close(): void {
    requestId += 1;
    meaningRoot = null;
    card.remove();
    empty.hidden = false;
  }

  function show(query: string, state: CardState, isDetail = false): void {
    empty.hidden = true;
    if (!card.isConnected) shadow.append(card);
    renderCard(card, query, state, {
      onClose: close,
      onRetry: () => void lookUp(query, isDetail),
      onLookup: (word) => void lookUp(word),
      onSelectMeaning: (title) => {
        if (!meaningRoot && state.kind === 'result' && state.result.status === 'found') {
          meaningRoot = { query, result: state.result };
        }
        void lookUp(title, true);
      },
      onBackToMeanings:
        isDetail && meaningRoot
          ? () => {
              requestId += 1;
              const root = meaningRoot;
              if (!root) return;
              meaningRoot = null;
              show(root.query, { kind: 'result', result: root.result });
            }
          : undefined,
    });
  }

  async function lookUp(query: string, isDetail = false): Promise<void> {
    if (!isDetail) meaningRoot = null;
    currentQuery = query;
    const id = ++requestId;
    show(query, { kind: 'loading' }, isDetail);
    let result: LookupResult;
    try {
      result = await lookup(query);
    } catch {
      result = { status: 'network_error' };
    }
    if (id !== requestId) return;
    show(query, { kind: 'result', result }, isDetail);
  }

  return {
    showSelection(selection) {
      const check = checkSelection(selection);
      if (check.kind === 'empty') return;
      if (check.kind === 'too_long') {
        requestId += 1;
        meaningRoot = null;
        currentQuery = '';
        show('', { kind: 'too_long' });
        return;
      }
      if (check.query === currentQuery && card.isConnected) return;
      void lookUp(check.query);
    },
    setTheme(theme) {
      host.dataset.theme = theme;
    },
    clear() {
      currentQuery = '';
      close();
    },
  };
}
