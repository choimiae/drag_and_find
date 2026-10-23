import type { LookupResult } from '../lookup/types';
import { checkSelection, isInEditableContext } from '../selection';
import type { CardState } from '../ui/card';
import type { Overlay } from '../ui/overlay';
import type { Rect } from '../ui/position';

export interface ControllerDeps {
  win: Window;
  overlay: Overlay;
  requestLookup(query: string): Promise<LookupResult>;
  isIconEnabled(): Promise<boolean>;
}

export interface Controller {
  handleMouseUp(event: Event): void;
  handleMouseDown(event: Event): void;
  handleKeyDown(event: KeyboardEvent): void;
  handleShortcut(): void;
}

interface SelectionSnapshot {
  text: string;
  anchor: Rect;
}

/** 선택·클릭·키 입력을 받아 아이콘과 카드를 제어한다. 마지막 요청의 결과만 카드에 반영한다. */
export function createController(deps: ControllerDeps): Controller {
  const { win, overlay } = deps;
  let latestRequestId = 0;

  function readSelection(): SelectionSnapshot | null {
    const selection = win.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
    if (isInEditableContext(selection.anchorNode, win.document.activeElement)) return null;
    const range = selection.getRangeAt(selection.rangeCount - 1);
    const rects = range.getClientRects();
    const last = rects[rects.length - 1] ?? range.getBoundingClientRect();
    return {
      text: selection.toString(),
      anchor: { top: last.top, left: last.left, bottom: last.bottom, right: last.right },
    };
  }

  function closeAll(): void {
    latestRequestId += 1;
    overlay.hideCard();
    overlay.hideIcon();
  }

  function showCard(anchor: Rect, query: string, state: CardState): void {
    overlay.showCard(anchor, query, state, {
      onClose: closeAll,
      onRetry: () => void lookUp(query, anchor),
    });
  }

  async function lookUp(query: string, anchor: Rect): Promise<void> {
    latestRequestId += 1;
    const requestId = latestRequestId;
    overlay.hideIcon();
    showCard(anchor, query, { kind: 'loading' });
    const result = await deps.requestLookup(query);
    if (requestId !== latestRequestId) return;
    showCard(anchor, query, { kind: 'result', result });
  }

  async function isIconEnabledSafely(): Promise<boolean> {
    try {
      return await deps.isIconEnabled();
    } catch {
      // 확장이 업데이트되면 열려 있던 페이지의 확장 연결이 끊겨 설정을 읽지 못한다.
      return false;
    }
  }

  async function showIconForSelection(): Promise<void> {
    const snapshot = readSelection();
    const check = snapshot ? checkSelection(snapshot.text) : null;
    if (!snapshot || check?.kind !== 'ok' || !(await isIconEnabledSafely())) {
      overlay.hideIcon();
      return;
    }
    overlay.showIcon(snapshot.anchor, () => void lookUp(check.query, snapshot.anchor));
  }

  return {
    handleMouseUp(event) {
      if (overlay.contains(event)) return;
      // 클릭으로 선택이 풀리는 경우 mouseup 직후에야 선택 상태가 확정된다.
      win.setTimeout(() => void showIconForSelection(), 0);
    },
    handleMouseDown(event) {
      if (!overlay.contains(event)) closeAll();
    },
    handleKeyDown(event) {
      if (event.key === 'Escape') closeAll();
    },
    handleShortcut() {
      const snapshot = readSelection();
      if (!snapshot) return;
      const check = checkSelection(snapshot.text);
      if (check.kind === 'empty') return;
      if (check.kind === 'too_long') {
        latestRequestId += 1;
        overlay.hideIcon();
        showCard(snapshot.anchor, '', { kind: 'too_long' });
        return;
      }
      void lookUp(check.query, snapshot.anchor);
    },
  };
}
