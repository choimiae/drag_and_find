import { describe, it, expect, vi } from 'vitest';
import { LOOKUP_COMMAND, createShortcutHandler, type ShortcutDeps } from '../../lib/shortcut';

function deps(activeTabId: number | null = 7) {
  return {
    getActiveTabId: vi.fn<ShortcutDeps['getActiveTabId']>(async () => activeTabId ?? undefined),
    sendToTab: vi.fn<ShortcutDeps['sendToTab']>(async () => undefined),
  };
}

describe('createShortcutHandler', () => {
  it('sends the trigger message to the tab the command came from', async () => {
    const d = deps();

    await createShortcutHandler(d)(LOOKUP_COMMAND, 3);

    expect(d.sendToTab).toHaveBeenCalledWith(3, { type: 'trigger-from-shortcut' });
    expect(d.getActiveTabId).not.toHaveBeenCalled();
  });

  it('falls back to the active tab', async () => {
    const d = deps(7);

    await createShortcutHandler(d)(LOOKUP_COMMAND);

    expect(d.sendToTab).toHaveBeenCalledWith(7, { type: 'trigger-from-shortcut' });
  });

  it('ignores other commands', async () => {
    const d = deps();

    await createShortcutHandler(d)('other-command', 3);

    expect(d.sendToTab).not.toHaveBeenCalled();
  });

  it('does nothing without a tab', async () => {
    const d = deps(null);

    await createShortcutHandler(d)(LOOKUP_COMMAND);

    expect(d.sendToTab).not.toHaveBeenCalled();
  });

  it('does not throw when the tab has no content script', async () => {
    const d = deps();
    d.sendToTab.mockRejectedValue(new Error('Receiving end does not exist.'));

    await expect(createShortcutHandler(d)(LOOKUP_COMMAND, 3)).resolves.toBeUndefined();
  });
});
