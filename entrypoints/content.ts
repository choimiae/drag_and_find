import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createController } from '../lib/content/controller';
import { createLookupClient } from '../lib/lookup/client';
import { isTriggerRequest } from '../lib/messages';
import { watchTheme } from '../lib/content/theme';
import { SETTINGS_KEY, loadSettings } from '../lib/settings';
import { createOverlay } from '../lib/ui/overlay';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  main() {
    const overlay = createOverlay(document, window);
    const controller = createController({
      win: window,
      overlay,
      requestLookup: createLookupClient((message) => browser.runtime.sendMessage(message)),
      isIconEnabled: async () => (await loadSettings(browser.storage.local)).showIcon,
    });

    void watchTheme({
      loadSettings: () => loadSettings(browser.storage.local),
      onSettingsChanged: (listener) =>
        browser.storage.onChanged.addListener((changes, areaName) => {
          const change = changes[SETTINGS_KEY];
          if (areaName === 'local' && change) listener(change.newValue);
        }),
      applyTheme: (theme) => overlay.setTheme(theme),
    });

    document.addEventListener('mouseup', controller.handleMouseUp, true);
    document.addEventListener('mousedown', controller.handleMouseDown, true);
    document.addEventListener('keydown', controller.handleKeyDown, true);
    browser.runtime.onMessage.addListener((message) => {
      if (isTriggerRequest(message)) controller.handleShortcut();
    });
  },
});
