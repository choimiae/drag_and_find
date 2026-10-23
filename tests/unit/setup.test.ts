import { describe, it, expect, beforeEach } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';

describe('test setup', () => {
  beforeEach(() => fakeBrowser.reset());

  it('provides a fake extension storage', async () => {
    await browser.storage.local.set({ ready: true });
    expect(await browser.storage.local.get('ready')).toEqual({ ready: true });
  });
});
