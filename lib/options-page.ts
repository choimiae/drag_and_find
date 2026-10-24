import {
  DEFAULT_SETTINGS,
  isThemeSetting,
  loadSettings,
  saveSettings,
  type Settings,
} from './settings';
import type { KeyValueArea } from './storage';

const NO_SHORTCUT_TEXT = '지정되지 않음';

export interface OptionsPageDeps {
  area: KeyValueArea;
  getShortcut(): Promise<string | undefined>;
  openShortcutSettings(): Promise<void>;
}

/** 설정 화면의 카드 테마, 아이콘 켜기·끄기, 단축키 안내를 연결한다. */
export async function initOptionsPage(doc: Document, deps: OptionsPageDeps): Promise<void> {
  const checkbox = requireElement<HTMLInputElement>(doc, '#show-icon');
  const themeGroup = requireElement<HTMLElement>(doc, '#theme');
  const themeInputs = Array.from(
    themeGroup.querySelectorAll<HTMLInputElement>('input[name="theme"]'),
  );
  const shortcutLabel = requireElement<HTMLElement>(doc, '#shortcut');
  const shortcutButton = requireElement<HTMLButtonElement>(doc, '#change-shortcut');

  const session = createSettingsSession(deps.area, (settings) => {
    checkbox.checked = settings.showIcon;
    for (const input of themeInputs) input.checked = input.value === settings.theme;
  });

  // 불러오기가 늦거나 실패해도 조작은 되도록, 리스너는 await 전에 붙인다.
  checkbox.addEventListener('change', () => session.update({ showIcon: checkbox.checked }));
  for (const input of themeInputs) {
    input.addEventListener('change', () => {
      if (input.checked && isThemeSetting(input.value)) session.update({ theme: input.value });
    });
  }
  shortcutButton.addEventListener('click', () => void deps.openShortcutSettings());

  try {
    session.applyLoaded(await loadSettings(deps.area));
  } catch {
    // 읽기 실패 시 기본값을 그대로 쓴다.
  }

  try {
    shortcutLabel.textContent = (await deps.getShortcut()) || NO_SHORTCUT_TEXT;
  } catch {
    shortcutLabel.textContent = NO_SHORTCUT_TEXT;
  }
}

function requireElement<T extends Element>(doc: Document, selector: string): T {
  const found = doc.querySelector<T>(selector);
  if (!found) throw new Error(`설정 화면 요소가 없습니다: ${selector}`);
  return found;
}

interface SettingsSession {
  update(patch: Partial<Settings>): void;
  applyLoaded(loaded: Settings): void;
}

/**
 * 화면이 보여 주는 값(desired)과 저장이 확인된 값(saved)을 나눠 들고,
 * 저장을 순서대로 하나씩 실행한다. 겹친 변경도 서로의 값을 잃지 않는다.
 */
function createSettingsSession(
  area: KeyValueArea,
  render: (settings: Settings) => void,
): SettingsSession {
  let desired: Settings = DEFAULT_SETTINGS;
  let saved: Settings = DEFAULT_SETTINGS;
  let requested = 0;
  let isChangedByUser = false;
  let queue: Promise<void> = Promise.resolve();

  render(desired);

  return {
    update(patch) {
      isChangedByUser = true;
      desired = { ...desired, ...patch };
      const snapshot = desired;
      const sequence = ++requested;
      queue = queue.then(() =>
        saveSettings(area, snapshot).then(
          () => {
            saved = snapshot;
          },
          () => {
            // 더 새로운 저장이 대기 중이면 그쪽이 모든 필드를 담고 있으므로 되돌리지 않는다.
            if (sequence !== requested) return;
            desired = saved;
            render(desired);
          },
        ),
      );
    },
    applyLoaded(loaded) {
      // 불러오는 중에 사용자가 이미 바꿨다면 그 값이 우선이다.
      if (isChangedByUser) return;
      saved = loaded;
      desired = loaded;
      render(desired);
    },
  };
}
