import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { createAnalyticsClient } from '../lib/analytics/client';
import { createBrowserWikipediaProvider } from '../lib/lookup/browser-wikipedia';
import { createFallbackLookupService } from '../lib/lookup/fallback-service';
import { createLookupMessageHandler } from '../lib/lookup/message-handler';
import { createLookupService } from '../lib/lookup/service';
import { createEnglishContextClient, createWorkerProvider } from '../lib/lookup/worker-client';
import { createShortcutHandler } from '../lib/shortcut';

export default defineBackground(() => {
  const workerUrl = import.meta.env.WXT_LOOKUP_API_URL ?? '';
  const lookup = createFallbackLookupService(
    createLookupService(
      createWorkerProvider(workerUrl),
      undefined,
      createEnglishContextClient(workerUrl),
    ),
    createLookupService(createBrowserWikipediaProvider()),
  );
  const analytics = createAnalyticsClient({
    workerUrl,
    version: browser.runtime.getManifest().version,
    storage: browser.storage.local,
  });
  const handleLookup = createLookupMessageHandler(lookup, (result) => {
    void analytics.recordLookupOutcome(result);
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const pending = handleLookup(message);
    if (!pending) return undefined;
    // 어떤 이유로든 조회가 실패하면 페이지가 "찾는 중"에 멈추지 않도록 오류 결과로 답한다.
    void pending.then(sendResponse, () => sendResponse({ status: 'network_error' }));
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
