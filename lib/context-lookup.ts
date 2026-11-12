export interface ContextLookupDeps {
  openPanel(tabId: number): Promise<void>;
  saveSelection(tabId: number, selection: string): Promise<void>;
}

export function createContextLookupHandler(deps: ContextLookupDeps) {
  return async (selection: string, tabId: number | undefined): Promise<void> => {
    if (tabId === undefined) return;
    const check = checkSelection(selection);
    if (check.kind === 'empty') return;
    // 패널 열기는 우클릭이라는 사용자 동작 안에서 바로 호출해야 한다.
    const opening = deps.openPanel(tabId);
    const saved =
      check.kind === 'ok'
        ? check.query
        : Array.from(normalizeQuery(selection))
            .slice(0, MAX_QUERY_LENGTH + 1)
            .join('');
    await Promise.all([opening, deps.saveSelection(tabId, saved)]);
  };
}
import { checkSelection, normalizeQuery, MAX_QUERY_LENGTH } from './selection';

export const CONTEXT_LOOKUP_MENU_ID = 'lookup-selected-text';

export function contextSelectionKey(tabId: number): string {
  return `context-selection:${tabId}`;
}
