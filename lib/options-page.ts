import { loadSettings, saveSettings } from './settings';
import type { KeyValueArea } from './storage';

const NO_SHORTCUT_TEXT = '지정되지 않음';

export interface OptionsPageDeps {
  area: KeyValueArea;
  getShortcut(): Promise<string | undefined>;
  openShortcutSettings(): Promise<void>;
}

/** 설정 화면의 아이콘 켜기·끄기와 단축키 안내를 연결한다. */
export async function initOptionsPage(doc: Document, deps: OptionsPageDeps): Promise<void> {
  const checkbox = requireElement<HTMLInputElement>(doc, '#show-icon');
  const shortcutLabel = requireElement<HTMLElement>(doc, '#shortcut');
  const shortcutButton = requireElement<HTMLButtonElement>(doc, '#change-shortcut');

  const settings = await loadSettings(deps.area);
  checkbox.checked = settings.showIcon;
  checkbox.addEventListener('change', () => {
    void saveSettings(deps.area, { ...settings, showIcon: checkbox.checked });
  });

  shortcutLabel.textContent = (await deps.getShortcut()) || NO_SHORTCUT_TEXT;
  shortcutButton.addEventListener('click', () => void deps.openShortcutSettings());
}

function requireElement<T extends Element>(doc: Document, selector: string): T {
  const found = doc.querySelector<T>(selector);
  if (!found) throw new Error(`설정 화면 요소가 없습니다: ${selector}`);
  return found;
}
