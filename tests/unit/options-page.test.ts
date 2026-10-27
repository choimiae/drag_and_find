import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initOptionsPage, type OptionsPageDeps } from '../../lib/options-page';
import { loadSettings, saveSettings } from '../../lib/settings';
import { memoryArea } from './memory-area';

const MARKUP = `
  <fieldset id="theme">
    <input type="radio" name="theme" value="auto" id="theme-auto" />
    <input type="radio" name="theme" value="light" id="theme-light" />
    <input type="radio" name="theme" value="dark" id="theme-dark" />
  </fieldset>
  <fieldset id="search-engine">
    <input type="radio" name="search-engine" value="naver" id="search-engine-naver" />
    <input type="radio" name="search-engine" value="google" id="search-engine-google" />
  </fieldset>
  <input id="show-icon" type="checkbox" role="switch" />
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
    await saveSettings(area, { showIcon: false, theme: 'auto', searchEngine: 'naver' });

    await initOptionsPage(document, deps({ area }));

    expect(checkbox().checked).toBe(false);
  });

  it('saves the icon setting when toggled', async () => {
    const area = memoryArea();
    await initOptionsPage(document, deps({ area }));

    checkbox().checked = false;
    checkbox().dispatchEvent(new Event('change'));
    await flush();

    expect(await loadSettings(area)).toEqual({
      showIcon: false,
      theme: 'auto',
      searchEngine: 'naver',
    });
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

    expect(await loadSettings(stored)).toEqual({
      showIcon: false,
      theme: 'auto',
      searchEngine: 'naver',
    });
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

    expect(await loadSettings(area)).toEqual({
      showIcon: true,
      theme: 'auto',
      searchEngine: 'naver',
    });
  });

  it('fails clearly when the markup is missing', async () => {
    document.body.innerHTML = '';

    await expect(initOptionsPage(document, deps())).rejects.toThrow('#show-icon');
  });
});

describe('theme', () => {
  const radio = (theme: string) => document.getElementById(`theme-${theme}`) as HTMLInputElement;
  const choose = (theme: string) => {
    radio(theme).checked = true;
    radio(theme).dispatchEvent(new Event('change'));
  };

  it('selects "follow Chrome" when nothing is stored', async () => {
    await initOptionsPage(document, deps());

    expect(radio('auto').checked).toBe(true);
  });

  it('shows the stored theme', async () => {
    const area = memoryArea();
    await saveSettings(area, { showIcon: true, theme: 'dark', searchEngine: 'naver' });

    await initOptionsPage(document, deps({ area }));

    expect(radio('dark').checked).toBe(true);
  });

  it('saves the chosen theme and keeps the icon setting', async () => {
    const area = memoryArea();
    await saveSettings(area, { showIcon: false, theme: 'auto', searchEngine: 'naver' });
    await initOptionsPage(document, deps({ area }));

    choose('light');
    await flush();

    expect(await loadSettings(area)).toEqual({
      showIcon: false,
      theme: 'light',
      searchEngine: 'naver',
    });
  });

  it('puts the previous theme back when saving fails', async () => {
    const area = memoryArea();
    await saveSettings(area, { showIcon: true, theme: 'light', searchEngine: 'naver' });
    const failing = { ...area, set: async () => Promise.reject(new Error('quota')) };
    await initOptionsPage(document, deps({ area: failing }));

    choose('dark');
    await flush();

    expect(radio('light').checked).toBe(true);
    expect(radio('dark').checked).toBe(false);
  });

  it('fails clearly when the theme choices are missing', async () => {
    document.getElementById('theme')?.remove();

    await expect(initOptionsPage(document, deps())).rejects.toThrow('#theme');
  });
});

describe('search engine', () => {
  const engine = (name: string) =>
    document.getElementById(`search-engine-${name}`) as HTMLInputElement;

  it('checks naver when nothing is stored', async () => {
    await initOptionsPage(document, deps());

    expect(engine('naver').checked).toBe(true);
    expect(engine('google').checked).toBe(false);
  });

  it('shows the stored search engine', async () => {
    const area = memoryArea();
    await saveSettings(area, { showIcon: true, theme: 'auto', searchEngine: 'google' });

    await initOptionsPage(document, deps({ area }));

    expect(engine('google').checked).toBe(true);
  });

  it('saves the chosen search engine and keeps other settings', async () => {
    const area = memoryArea();
    await saveSettings(area, { showIcon: false, theme: 'dark', searchEngine: 'naver' });
    await initOptionsPage(document, deps({ area }));

    engine('google').checked = true;
    engine('google').dispatchEvent(new Event('change'));
    await flush();

    expect(await loadSettings(area)).toEqual({
      showIcon: false,
      theme: 'dark',
      searchEngine: 'google',
    });
  });

  it('puts the previous search engine back when saving fails', async () => {
    const area = memoryArea();
    await saveSettings(area, { showIcon: true, theme: 'auto', searchEngine: 'naver' });
    const failing = { ...area, set: async () => Promise.reject(new Error('quota')) };
    await initOptionsPage(document, deps({ area: failing }));

    engine('google').checked = true;
    engine('google').dispatchEvent(new Event('change'));
    await flush();

    expect(engine('naver').checked).toBe(true);
    expect(engine('google').checked).toBe(false);
  });
});

it('exposes the icon toggle as a switch', async () => {
  await initOptionsPage(document, deps());

  expect(document.getElementById('show-icon')?.getAttribute('role')).toBe('switch');
});

describe('overlapping changes', () => {
  const radio = (theme: string) => document.getElementById(`theme-${theme}`) as HTMLInputElement;
  const chooseDark = () => {
    radio('dark').checked = true;
    radio('dark').dispatchEvent(new Event('change'));
  };
  const switchOff = () => {
    checkbox().checked = false;
    checkbox().dispatchEvent(new Event('change'));
  };

  it('keeps both changes when the switch is toggled right after the theme', async () => {
    const area = memoryArea();
    await initOptionsPage(document, deps({ area }));

    chooseDark();
    switchOff();
    await flush();

    expect(await loadSettings(area)).toEqual({
      showIcon: false,
      theme: 'dark',
      searchEngine: 'naver',
    });
  });

  it('keeps the newer switch value when only the earlier save fails', async () => {
    const stored = memoryArea();
    let calls = 0;
    const area = {
      get: stored.get,
      set: async (items: Record<string, unknown>) => {
        calls += 1;
        if (calls === 1) throw new Error('quota');
        await stored.set(items);
      },
    };
    await initOptionsPage(document, deps({ area }));

    chooseDark();
    switchOff();
    await flush();

    expect(checkbox().checked).toBe(false);
    expect(radio('dark').checked).toBe(true);
    expect(await loadSettings(stored)).toEqual({
      showIcon: false,
      theme: 'dark',
      searchEngine: 'naver',
    });
  });

  it('keeps a change made before loading finishes', async () => {
    const stored = memoryArea();
    await saveSettings(stored, { showIcon: true, theme: 'light', searchEngine: 'naver' });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const area = {
      get: async (key: string) => {
        await gate;
        return stored.get(key);
      },
      set: stored.set,
    };
    const ready = initOptionsPage(document, deps({ area }));

    switchOff();
    release();
    await ready;
    await flush();

    expect(checkbox().checked).toBe(false);
    expect(await loadSettings(stored)).toEqual({
      showIcon: false,
      theme: 'auto',
      searchEngine: 'naver',
    });
  });
});
