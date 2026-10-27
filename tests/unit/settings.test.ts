import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  isSearchEngine,
  isThemeSetting,
  loadSettings,
  parseSettings,
  saveSettings,
} from '../../lib/settings';
import { memoryArea } from './memory-area';

describe('settings', () => {
  it('uses defaults when nothing is stored', async () => {
    expect(await loadSettings(memoryArea())).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.showIcon).toBe(true);
    expect(DEFAULT_SETTINGS.theme).toBe('auto');
    expect(DEFAULT_SETTINGS.searchEngine).toBe('naver');
  });

  it('reads what was saved', async () => {
    const area = memoryArea();

    await saveSettings(area, { showIcon: false, theme: 'dark', searchEngine: 'naver' });

    expect(await loadSettings(area)).toEqual({
      showIcon: false,
      theme: 'dark',
      searchEngine: 'naver',
    });
  });

  it.each([null, 'off', { showIcon: 'no' }, []])('falls back to defaults for %j', (raw) => {
    expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('theme', () => {
  it.each(['auto', 'light', 'dark'] as const)('keeps %s', (theme) => {
    expect(parseSettings({ showIcon: true, theme }).theme).toBe(theme);
  });

  it.each(['system', 3, null, undefined])('falls back to auto for %j', (theme) => {
    expect(parseSettings({ showIcon: false, theme })).toEqual({
      showIcon: false,
      theme: 'auto',
      searchEngine: 'naver',
    });
  });

  it('reads settings saved before themes existed', () => {
    expect(parseSettings({ showIcon: false })).toEqual({
      showIcon: false,
      theme: 'auto',
      searchEngine: 'naver',
    });
  });
});

describe('isThemeSetting', () => {
  it('accepts only the three themes', () => {
    expect(isThemeSetting('dark')).toBe(true);
    expect(isThemeSetting('Dark')).toBe(false);
    expect(isThemeSetting(undefined)).toBe(false);
  });
});

describe('searchEngine', () => {
  it.each(['naver', 'google'] as const)('keeps %s', (searchEngine) => {
    expect(parseSettings({ showIcon: true, theme: 'auto', searchEngine }).searchEngine).toBe(
      searchEngine,
    );
  });

  it.each(['Naver', 'bing', 3, null, undefined])('falls back to naver for %j', (searchEngine) => {
    expect(parseSettings({ showIcon: false, theme: 'dark', searchEngine })).toEqual({
      showIcon: false,
      theme: 'dark',
      searchEngine: 'naver',
    });
  });

  it('reads settings saved before search engines existed', () => {
    expect(parseSettings({ showIcon: false, theme: 'light' })).toEqual({
      showIcon: false,
      theme: 'light',
      searchEngine: 'naver',
    });
  });
});

describe('isSearchEngine', () => {
  it('accepts only the two sites', () => {
    expect(isSearchEngine('google')).toBe(true);
    expect(isSearchEngine('Google')).toBe(false);
  });
});
