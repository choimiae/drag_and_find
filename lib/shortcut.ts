import { TRIGGER_MESSAGE, type TriggerRequest } from './messages';

export const LOOKUP_COMMAND = 'lookup-selection';

export interface ShortcutDeps {
  getActiveTabId(): Promise<number | undefined>;
  sendToTab(tabId: number, message: TriggerRequest): Promise<unknown>;
}

/** 단축키가 눌리면 해당 탭의 페이지 쪽에 "지금 선택으로 찾기"를 알린다. */
export function createShortcutHandler(
  deps: ShortcutDeps,
): (command: string, tabId?: number) => Promise<void> {
  return async (command, tabId) => {
    if (command !== LOOKUP_COMMAND) return;
    const target = tabId ?? (await deps.getActiveTabId());
    if (target === undefined) return;
    try {
      await deps.sendToTab(target, { type: TRIGGER_MESSAGE });
    } catch {
      // chrome:// 페이지·웹스토어처럼 content script가 없는 탭은 받을 쪽이 없다. 할 일이 없으므로 무시한다.
    }
  };
}
