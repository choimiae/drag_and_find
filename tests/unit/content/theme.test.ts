import { describe, it, expect, vi } from 'vitest';
import { watchTheme, type ThemeWatchDeps } from '../../../lib/content/theme';

function deps(overrides: Partial<ThemeWatchDeps> = {}) {
  let listener: ((raw: unknown) => void) | undefined;
  const base = {
    loadSettings: vi.fn<ThemeWatchDeps['loadSettings']>(async () => ({
      showIcon: true,
      theme: 'light',
      searchEngine: 'naver',
    })),
    onSettingsChanged: vi.fn<ThemeWatchDeps['onSettingsChanged']>((l) => {
      listener = l;
    }),
    applyTheme: vi.fn<ThemeWatchDeps['applyTheme']>(),
    ...overrides,
  };
  return { ...base, change: (raw: unknown) => listener?.(raw) };
}

describe('watchTheme', () => {
  it('applies the saved theme at start', async () => {
    const d = deps();

    await watchTheme(d);

    expect(d.applyTheme).toHaveBeenCalledWith('light');
  });

  it('applies a changed theme right away', async () => {
    const d = deps();
    await watchTheme(d);

    d.change({ showIcon: true, theme: 'dark', searchEngine: 'naver' });

    expect(d.applyTheme).toHaveBeenLastCalledWith('dark');
  });

  it('uses auto for a malformed change', async () => {
    const d = deps();
    await watchTheme(d);

    d.change('broken');

    expect(d.applyTheme).toHaveBeenLastCalledWith('auto');
  });

  it('keeps the default without throwing when settings cannot be read', async () => {
    const d = deps({
      loadSettings: async () => {
        throw new Error('Extension context invalidated.');
      },
    });

    await expect(watchTheme(d)).resolves.toBeUndefined();
    expect(d.applyTheme).not.toHaveBeenCalled();
  });
});
