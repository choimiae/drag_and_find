import { browser } from 'wxt/browser';
import { initOptionsPage } from '../../lib/options-page';
import { LOOKUP_COMMAND } from '../../lib/shortcut';

void initOptionsPage(document, {
  area: browser.storage.local,
  getShortcut: async () =>
    (await browser.commands.getAll()).find((command) => command.name === LOOKUP_COMMAND)
      ?.shortcut || undefined,
  openShortcutSettings: async () => {
    await browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
  },
});
