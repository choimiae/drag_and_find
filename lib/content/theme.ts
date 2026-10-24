import { parseSettings, type Settings, type ThemeSetting } from '../settings';

export interface ThemeWatchDeps {
  loadSettings(): Promise<Settings>;
  onSettingsChanged(listener: (raw: unknown) => void): void;
  applyTheme(theme: ThemeSetting): void;
}

/** 저장된 카드 테마를 적용하고, 설정이 바뀌면 열려 있는 탭에도 바로 다시 적용한다. */
export async function watchTheme(deps: ThemeWatchDeps): Promise<void> {
  deps.onSettingsChanged((raw) => deps.applyTheme(parseSettings(raw).theme));
  try {
    deps.applyTheme((await deps.loadSettings()).theme);
  } catch {
    // 확장이 업데이트돼 연결이 끊긴 탭은 설정을 읽지 못한다. 기본 테마(auto)를 그대로 둔다.
  }
}
