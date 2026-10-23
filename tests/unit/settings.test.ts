import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, parseSettings, saveSettings } from '../../lib/settings';
import { memoryArea } from './memory-area';

describe('settings', () => {
  it('uses defaults when nothing is stored', async () => {
    expect(await loadSettings(memoryArea())).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.showIcon).toBe(true);
  });

  it('reads what was saved', async () => {
    const area = memoryArea();

    await saveSettings(area, { showIcon: false });

    expect(await loadSettings(area)).toEqual({ showIcon: false });
  });

  it.each([null, 'off', { showIcon: 'no' }, []])('falls back to defaults for %j', (raw) => {
    expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS);
  });
});
