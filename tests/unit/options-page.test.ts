import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initOptionsPage, type OptionsPageDeps } from '../../lib/options-page';
import { loadSettings, saveSettings } from '../../lib/settings';
import { memoryArea } from './memory-area';

const MARKUP = `
  <input id="show-icon" type="checkbox" />
  <span id="shortcut"></span>
  <button id="change-shortcut" type="button"></button>`;

function deps(overrides: Partial<OptionsPageDeps> = {}): OptionsPageDeps {
  return {
    area: memoryArea(),
    getShortcut: async () => '⌥⇧F',
    openShortcutSettings: vi.fn(async () => undefined),
    ...overrides,
  };
}

const checkbox = () => document.getElementById('show-icon') as HTMLInputElement;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  document.body.innerHTML = MARKUP;
});

describe('initOptionsPage', () => {
  it('shows the stored icon setting', async () => {
    const area = memoryArea();
    await saveSettings(area, { showIcon: false, theme: 'auto' });

    await initOptionsPage(document, deps({ area }));

    expect(checkbox().checked).toBe(false);
  });

  it('saves the icon setting when toggled', async () => {
    const area = memoryArea();
    await initOptionsPage(document, deps({ area }));

    checkbox().checked = false;
    checkbox().dispatchEvent(new Event('change'));
    await flush();

    expect(await loadSettings(area)).toEqual({ showIcon: false, theme: 'auto' });
  });

  it('shows the current shortcut', async () => {
    await initOptionsPage(document, deps());

    expect(document.getElementById('shortcut')?.textContent).toBe('⌥⇧F');
  });

  it('says when no shortcut is assigned', async () => {
    await initOptionsPage(document, deps({ getShortcut: async () => undefined }));

    expect(document.getElementById('shortcut')?.textContent).toBe('지정되지 않음');
  });

  it('opens the browser shortcut settings', async () => {
    const d = deps();
    await initOptionsPage(document, d);

    document.getElementById('change-shortcut')?.click();

    expect(d.openShortcutSettings).toHaveBeenCalledTimes(1);
  });

  it('shows the no-shortcut text and still opens settings when reading the shortcut fails', async () => {
    const d = deps({
      getShortcut: async () => {
        throw new Error('commands unavailable');
      },
    });

    await initOptionsPage(document, d);
    document.getElementById('change-shortcut')?.click();

    expect(document.getElementById('shortcut')?.textContent).toBe('지정되지 않음');
    expect(d.openShortcutSettings).toHaveBeenCalledTimes(1);
  });

  it('keeps the default setting and still saves when loading fails', async () => {
    const stored = memoryArea();
    const area = {
      get: async () => {
        throw new Error('read failed');
      },
      set: stored.set,
    };

    await initOptionsPage(document, deps({ area }));
    expect(checkbox().checked).toBe(true);

    checkbox().checked = false;
    checkbox().dispatchEvent(new Event('change'));
    await flush();

    expect(await loadSettings(stored)).toEqual({ showIcon: false, theme: 'auto' });
  });

  it('puts the checkbox back when saving fails', async () => {
    const area = {
      ...memoryArea(),
      set: async () => {
        throw new Error('write failed');
      },
    };
    await initOptionsPage(document, deps({ area }));
    expect(checkbox().checked).toBe(true);

    checkbox().checked = false;
    checkbox().dispatchEvent(new Event('change'));
    await flush();

    expect(checkbox().checked).toBe(true);
  });

  it('saves the icon setting again when toggled off and on', async () => {
    const area = memoryArea();
    await initOptionsPage(document, deps({ area }));

    checkbox().checked = false;
    checkbox().dispatchEvent(new Event('change'));
    await flush();
    checkbox().checked = true;
    checkbox().dispatchEvent(new Event('change'));
    await flush();

    expect(await loadSettings(area)).toEqual({ showIcon: true, theme: 'auto' });
  });

  it('fails clearly when the markup is missing', async () => {
    document.body.innerHTML = '';

    await expect(initOptionsPage(document, deps())).rejects.toThrow('#show-icon');
  });
});
