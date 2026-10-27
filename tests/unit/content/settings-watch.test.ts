import { describe, it, expect, vi } from 'vitest';
import { watchSettings, type SettingsWatchDeps } from '../../../lib/content/settings-watch';
import { DEFAULT_SETTINGS } from '../../../lib/settings';

function deps(overrides: Partial<SettingsWatchDeps> = {}) {
  let listener: ((raw: unknown) => void) | undefined;
  const base = {
    loadSettings: vi.fn<SettingsWatchDeps['loadSettings']>(async () => ({
      showIcon: true,
      theme: 'light',
      searchEngine: 'naver',
    })),
    onSettingsChanged: vi.fn<SettingsWatchDeps['onSettingsChanged']>((l) => {
      listener = l;
    }),
    applySettings: vi.fn<SettingsWatchDeps['applySettings']>(),
    ...overrides,
  };
  return { ...base, change: (raw: unknown) => listener?.(raw) };
}

describe('watchSettings', () => {
  it('applies the saved settings at start', async () => {
    const d = deps();

    await watchSettings(d);

    expect(d.applySettings).toHaveBeenCalledWith({
      showIcon: true,
      theme: 'light',
      searchEngine: 'naver',
    });
  });

  it('applies a changed theme right away', async () => {
    const d = deps();
    await watchSettings(d);

    d.change({ showIcon: true, theme: 'dark', searchEngine: 'naver' });

    expect(d.applySettings).toHaveBeenLastCalledWith({
      showIcon: true,
      theme: 'dark',
      searchEngine: 'naver',
    });
  });

  it('passes a changed search engine right away', async () => {
    const d = deps();
    await watchSettings(d);

    d.change({ showIcon: true, theme: 'auto', searchEngine: 'google' });

    expect(vi.mocked(d.applySettings).mock.lastCall?.[0].searchEngine).toBe('google');
  });

  it('uses defaults for a malformed change', async () => {
    const d = deps();
    await watchSettings(d);

    d.change('broken');

    expect(d.applySettings).toHaveBeenLastCalledWith(DEFAULT_SETTINGS);
  });

  it('keeps the default without throwing when settings cannot be read', async () => {
    const d = deps({
      loadSettings: async () => {
        throw new Error('Extension context invalidated.');
      },
    });

    await expect(watchSettings(d)).resolves.toBeUndefined();
    expect(d.applySettings).not.toHaveBeenCalled();
  });
});
