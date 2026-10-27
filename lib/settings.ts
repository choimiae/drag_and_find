import type { KeyValueArea } from './storage';

export const SETTINGS_KEY = 'settings';

export type ThemeSetting = 'auto' | 'light' | 'dark';
export const THEME_SETTINGS: readonly ThemeSetting[] = ['auto', 'light', 'dark'];

export type SearchEngine = 'naver' | 'google';
export const SEARCH_ENGINES: readonly SearchEngine[] = ['naver', 'google'];

export interface Settings {
  showIcon: boolean;
  theme: ThemeSetting;
  searchEngine: SearchEngine;
}

export const DEFAULT_SETTINGS: Settings = { showIcon: true, theme: 'auto', searchEngine: 'naver' };

/** 카드 테마로 쓸 수 있는 값인지 확인한다. */
export function isThemeSetting(value: unknown): value is ThemeSetting {
  return THEME_SETTINGS.includes(value as ThemeSetting);
}

/** Enter로 검색할 사이트로 쓸 수 있는 값인지 확인한다. */
export function isSearchEngine(value: unknown): value is SearchEngine {
  return SEARCH_ENGINES.includes(value as SearchEngine);
}

/** 저장된 값을 검증해 설정으로 바꾼다. 형식이 틀리거나 없는 항목은 기본값을 쓴다. */
export function parseSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return DEFAULT_SETTINGS;
  const { showIcon, theme, searchEngine } = raw as Record<string, unknown>;
  return {
    showIcon: typeof showIcon === 'boolean' ? showIcon : DEFAULT_SETTINGS.showIcon,
    theme: isThemeSetting(theme) ? theme : DEFAULT_SETTINGS.theme,
    searchEngine: isSearchEngine(searchEngine) ? searchEngine : DEFAULT_SETTINGS.searchEngine,
  };
}

/** 저장소에서 설정을 읽는다. */
export async function loadSettings(area: KeyValueArea): Promise<Settings> {
  return parseSettings((await area.get(SETTINGS_KEY))[SETTINGS_KEY]);
}

/** 설정을 저장소에 쓴다. */
export async function saveSettings(area: KeyValueArea, settings: Settings): Promise<void> {
  await area.set({ [SETTINGS_KEY]: settings });
}
