import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { createLookupCache } from '../lib/lookup/cache';
import { createLookupMessageHandler } from '../lib/lookup/message-handler';
import { createLookupService } from '../lib/lookup/service';
import { createWikipediaKoProvider } from '../lib/lookup/wikipedia';
import { createShortcutHandler } from '../lib/shortcut';

export default defineBackground(() => {
  const provider = createWikipediaKoProvider({
    userAgent: `DragAndFind/${browser.runtime.getManifest().version}`,
  });
  const lookup = createLookupService(provider, createLookupCache(browser.storage.session));
  const handleLookup = createLookupMessageHandler(lookup);

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const pending = handleLookup(message);
    if (!pending) return undefined;
    void pending.then(sendResponse);
    return true;
  });

  const handleShortcut = createShortcutHandler({
    getActiveTabId: async () =>
      (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.id,
    sendToTab: (tabId, message) => browser.tabs.sendMessage(tabId, message),
  });

  browser.commands.onCommand.addListener((command, tab) => {
    void handleShortcut(command, tab?.id);
  });
});
