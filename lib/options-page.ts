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

  let settings: Settings = DEFAULT_SETTINGS;
  const render = () => {
    checkbox.checked = settings.showIcon;
    for (const input of themeInputs) input.checked = input.value === settings.theme;
  };
  const persist = (next: Settings) =>
    saveSettings(deps.area, next).then(
      () => {
        settings = next;
      },
      // 저장되지 않은 상태를 화면이 보여 주지 않도록 직전 값으로 되돌린다.
      () => render(),
    );

  render();
  // 불러오기가 늦거나 실패해도 조작은 되도록, 리스너는 await 전에 붙인다.
  checkbox.addEventListener(
    'change',
    () => void persist({ ...settings, showIcon: checkbox.checked }),
  );
  for (const input of themeInputs) {
    input.addEventListener('change', () => {
      if (input.checked && isThemeSetting(input.value))
        void persist({ ...settings, theme: input.value });
    });
  }
  shortcutButton.addEventListener('click', () => void deps.openShortcutSettings());

  try {
    settings = await loadSettings(deps.area);
    render();
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
