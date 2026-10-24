import type { LookupResult } from '../lookup/types';
import { checkSelection, isInEditableContext } from '../selection';
import type { CardState } from '../ui/card';
import type { DocumentRect, Overlay } from '../ui/overlay';

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
  anchor: DocumentRect;
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
      // 문서 좌표로 저장해 두면 카드가 뜨기 전에 스크롤돼도 단어 옆에 놓인다.
      anchor: {
        top: last.top + win.scrollY,
        left: last.left + win.scrollX,
        bottom: last.bottom + win.scrollY,
        right: last.right + win.scrollX,
      },
    };
  }

  function closeAll(): void {
    latestRequestId += 1;
    overlay.hideCard();
    overlay.hideIcon();
  }

  function showCard(anchor: DocumentRect, query: string, state: CardState): void {
    overlay.showCard(anchor, query, state, {
      onClose: closeAll,
      onRetry: () => void lookUp(query, anchor),
    });
  }

  async function lookUp(query: string, anchor: DocumentRect): Promise<void> {
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
      // 단축키 알림은 탭의 모든 프레임에 전달된다. 포커스가 있는 프레임만 반응해야 카드가 두 개 뜨지 않는다.
      if (!win.document.hasFocus()) return;
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
