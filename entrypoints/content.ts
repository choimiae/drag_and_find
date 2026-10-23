import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createController } from '../lib/content/controller';
import { createLookupClient } from '../lib/lookup/client';
import { isTriggerRequest } from '../lib/messages';
import { loadSettings } from '../lib/settings';
import { createOverlay } from '../lib/ui/overlay';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    const controller = createController({
      win: window,
      overlay: createOverlay(document, window),
      requestLookup: createLookupClient((message) => browser.runtime.sendMessage(message)),
      isIconEnabled: async () => (await loadSettings(browser.storage.local)).showIcon,
    });

    document.addEventListener('mouseup', controller.handleMouseUp, true);
    document.addEventListener('mousedown', controller.handleMouseDown, true);
    document.addEventListener('keydown', controller.handleKeyDown, true);
    browser.runtime.onMessage.addListener((message) => {
      if (isTriggerRequest(message)) controller.handleShortcut();
    });
  },
});
