import { parseSettings, type Settings } from '../settings';

export interface SettingsWatchDeps {
  loadSettings(): Promise<Settings>;
  onSettingsChanged(listener: (raw: unknown) => void): void;
  applySettings(settings: Settings): void;
}

/** 저장된 설정을 적용하고, 설정이 바뀌면 열려 있는 탭에도 바로 다시 적용한다. */
export async function watchSettings(deps: SettingsWatchDeps): Promise<void> {
  deps.onSettingsChanged((raw) => deps.applySettings(parseSettings(raw)));
  try {
    deps.applySettings(await deps.loadSettings());
  } catch {
    // 확장이 업데이트돼 연결이 끊긴 탭은 설정을 읽지 못한다. 기본값(테마 auto, 검색 사이트 네이버)을 그대로 둔다.
  }
}
