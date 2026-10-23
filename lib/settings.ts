import type { KeyValueArea } from './storage';

export const SETTINGS_KEY = 'settings';

export interface Settings {
  showIcon: boolean;
}

export const DEFAULT_SETTINGS: Settings = { showIcon: true };

/** 저장된 값을 검증해 설정으로 바꾼다. 형식이 틀리면 기본값을 쓴다. */
export function parseSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return DEFAULT_SETTINGS;
  const { showIcon } = raw as Record<string, unknown>;
  return { showIcon: typeof showIcon === 'boolean' ? showIcon : DEFAULT_SETTINGS.showIcon };
}

/** 저장소에서 설정을 읽는다. */
export async function loadSettings(area: KeyValueArea): Promise<Settings> {
  return parseSettings((await area.get(SETTINGS_KEY))[SETTINGS_KEY]);
}

/** 설정을 저장소에 쓴다. */
export async function saveSettings(area: KeyValueArea, settings: Settings): Promise<void> {
  await area.set({ [SETTINGS_KEY]: settings });
}
