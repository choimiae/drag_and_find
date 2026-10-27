import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createController } from '../lib/content/controller';
import { createLookupClient } from '../lib/lookup/client';
import { isTriggerRequest } from '../lib/messages';
import { watchSettings } from '../lib/content/settings-watch';
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, type SearchEngine } from '../lib/settings';
import { createOverlay } from '../lib/ui/overlay';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  main() {
    const overlay = createOverlay(document, window);
    // 설정을 읽지 못하면(확장 업데이트로 연결이 끊긴 탭) 기본값이 그대로 남는다.
    let searchEngine: SearchEngine = DEFAULT_SETTINGS.searchEngine;
    const controller = createController({
      win: window,
      overlay,
      requestLookup: createLookupClient((message) => browser.runtime.sendMessage(message)),
      isIconEnabled: async () => (await loadSettings(browser.storage.local)).showIcon,
      getSearchEngine: () => searchEngine,
    });

    void watchSettings({
      loadSettings: () => loadSettings(browser.storage.local),
      onSettingsChanged: (listener) =>
        browser.storage.onChanged.addListener((changes, areaName) => {
          const change = changes[SETTINGS_KEY];
          if (areaName === 'local' && change) listener(change.newValue);
        }),
      applySettings: (settings) => {
        overlay.setTheme(settings.theme);
        searchEngine = settings.searchEngine;
      },
    });

    document.addEventListener('mouseup', controller.handleMouseUp, true);
    document.addEventListener('mousedown', controller.handleMouseDown, true);
    document.addEventListener('keydown', controller.handleKeyDown, true);
    browser.runtime.onMessage.addListener((message) => {
      if (isTriggerRequest(message)) controller.handleShortcut();
    });
  },
});
