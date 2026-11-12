import { browser } from 'wxt/browser';
import { contextSelectionKey } from '../../lib/context-lookup';
import { createLookupClient } from '../../lib/lookup/client';
import { SETTINGS_KEY, loadSettings } from '../../lib/settings';
import { createSidepanelView } from '../../lib/sidepanel-view';

const view = createSidepanelView(
  document,
  createLookupClient((message) => browser.runtime.sendMessage(message)),
);

let activeTabId: number | undefined;
let storageRevision = 0;
let activationRevision = 0;
const panelWindowId = browser.windows.getCurrent().then((current) => current.id);

async function loadSelection(tabId: number | undefined): Promise<void> {
  activeTabId = tabId;
  if (tabId === undefined) {
    view.clear();
    return;
  }
  const revision = storageRevision;
  const key = contextSelectionKey(tabId);
  const stored = await browser.storage.session.get(key);
  if (tabId !== activeTabId || revision !== storageRevision) return;
  const selection = stored[key];
  if (typeof selection === 'string') view.showSelection(selection);
  else view.clear();
}

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'session' && activeTabId !== undefined) {
    const change = changes[contextSelectionKey(activeTabId)];
    if (change) {
      storageRevision += 1;
      if (typeof change.newValue === 'string') view.showSelection(change.newValue);
      else view.clear();
    }
  }
  if (areaName === 'local' && changes[SETTINGS_KEY]) {
    void loadSettings(browser.storage.local).then((settings) => view.setTheme(settings.theme));
  }
});

browser.tabs.onActivated.addListener(({ tabId, windowId }) => {
  void panelWindowId.then((currentWindowId) => {
    if (windowId !== currentWindowId) return;
    activationRevision += 1;
    void loadSelection(tabId);
  });
});

void loadSettings(browser.storage.local).then((settings) => view.setTheme(settings.theme));
void panelWindowId.then(async (windowId) => {
  const revision = activationRevision;
  const tabs = await browser.tabs.query({ active: true, windowId });
  if (revision !== activationRevision) return;
  await loadSelection(tabs[0]?.id);
});
