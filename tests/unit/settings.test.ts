import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
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
  });

  it('reads what was saved', async () => {
    const area = memoryArea();

    await saveSettings(area, { showIcon: false, theme: 'dark' });

    expect(await loadSettings(area)).toEqual({ showIcon: false, theme: 'dark' });
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
    expect(parseSettings({ showIcon: false, theme })).toEqual({ showIcon: false, theme: 'auto' });
  });

  it('reads settings saved before themes existed', () => {
    expect(parseSettings({ showIcon: false })).toEqual({ showIcon: false, theme: 'auto' });
  });
});

describe('isThemeSetting', () => {
  it('accepts only the three themes', () => {
    expect(isThemeSetting('dark')).toBe(true);
    expect(isThemeSetting('Dark')).toBe(false);
    expect(isThemeSetting(undefined)).toBe(false);
  });
});
